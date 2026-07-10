import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSmsProvider } from "./sms/index.ts";
import { maskPhone, normalizeTurkishMobileForNetgsm } from "./sms/phone.ts";

type NotificationLog = {
  id: string;
  student_id: string;
  attendance_id: string | null;
  notification_type: "late" | "absent";
  phone: string;
  message: string;
  status: "pending" | "processing" | "sent" | "failed";
};

type NotificationUpdateResult = {
  ok: boolean;
  id: string;
  status: string | null;
  rowCount: number;
  errorMessage: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error("[SMS processor] Unhandled processor error", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
    return jsonResponse({ error: "Unexpected SMS processor error" }, 500);
  }
});

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const senderId = getRequiredEnv("NETGSM_HEADER");

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("users")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[SMS processor] Role lookup failed", {
      userId: authData.user.id,
      error: profileError.message,
    });
    return jsonResponse({ error: "Could not verify authorization" }, 500);
  }

  if (!profile?.is_active || !["admin", "staff"].includes(profile.role)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const body = await safeReadJson(request);
  const batchSize = clampBatchSize(body?.batchSize);
  const smsProvider = createSmsProvider();

  const { data: claimedRows, error: claimError } = await serviceClient.rpc("claim_pending_notification_logs", {
    batch_size: batchSize,
  });

  if (claimError) {
    console.error("[SMS processor] Claim failed", {
      error: claimError.message,
      timestamp: new Date().toISOString(),
    });
    return jsonResponse({ error: "Could not claim pending notifications" }, 500);
  }

  const rows = (claimedRows ?? []) as NotificationLog[];
  const results = [];

  for (const row of rows) {
    const normalizedPhone = normalizeTurkishMobileForNetgsm(row.phone);
    if (!normalizedPhone || !row.message.trim()) {
      const failedUpdate = await markFailed(
        serviceClient,
        row.id,
        smsProvider.provider,
        "Invalid phone number or blank message",
      );
      logAttempt(row.id, smsProvider.provider, false, "invalid-input", row.phone, false);

      if (!failedUpdate.ok) {
        logDatabaseUpdateFailure("mark invalid notification failed", failedUpdate);
        results.push({
          id: row.id,
          status: "database_update_failed",
          reason: failedUpdate.errorMessage,
        });
        continue;
      }

      results.push({ id: failedUpdate.id, status: "failed", reason: "invalid-input" });
      continue;
    }

    const result = await smsProvider.sendSms({
      phone: normalizedPhone,
      message: row.message,
      senderId,
    });

    if (result.success) {
      if (result.simulated) {
        const resetResult = await resetDryRunNotification(serviceClient, row.id);
        logAttempt(row.id, result.provider, true, result.providerResponseCode ?? "dry-run", normalizedPhone, true);

        if (!resetResult.ok) {
          logDatabaseUpdateFailure("dry-run reset failed", resetResult);
          results.push({
            id: row.id,
            status: "reset_failed",
            simulated: true,
            reason: resetResult.errorMessage,
          });
          continue;
        }

        results.push({ id: resetResult.id, status: "pending", simulated: true });
        continue;
      }

      const sentUpdate = await markSent(
        serviceClient,
        row.id,
        result.provider,
        result.providerMessageId,
      );

      logAttempt(row.id, result.provider, true, result.providerResponseCode ?? "sent", normalizedPhone, false);

      if (!sentUpdate.ok) {
        console.error("[SMS processor] CRITICAL delivery-state error", {
          notificationLogId: row.id,
          provider: result.provider,
          providerResponseCode: result.providerResponseCode ?? null,
          databaseUpdateError: sentUpdate.errorMessage,
          timestamp: new Date().toISOString(),
        });
        results.push({
          id: row.id,
          status: "delivery_state_unknown",
          reason: "SMS provider accepted the request, but the database could not be updated to sent.",
        });
        continue;
      }

      results.push({ id: sentUpdate.id, status: "sent", simulated: false });
    } else {
      const safeError = toSafeError(result.errorMessage);
      const failedUpdate = await markFailed(serviceClient, row.id, result.provider, safeError);
      logAttempt(row.id, result.provider, false, result.providerResponseCode ?? safeError, normalizedPhone, false);

      if (!failedUpdate.ok) {
        logDatabaseUpdateFailure("mark provider failure failed", failedUpdate);
        results.push({
          id: row.id,
          status: "database_update_failed",
          reason: failedUpdate.errorMessage,
        });
        continue;
      }

      results.push({ id: failedUpdate.id, status: "failed", reason: safeError });
    }
  }

  return jsonResponse({
    claimed: rows.length,
    processed: results.length,
    results,
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

function clampBatchSize(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

async function safeReadJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function markSent(
  serviceClient: ReturnType<typeof createClient>,
  id: string,
  provider: string,
  providerMessageId: string | null,
) {
  const { data, error } = await serviceClient
    .from("notification_logs")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider,
      provider_message_id: providerMessageId,
      error_message: null,
      processing_started_at: null,
    })
    .eq("id", id)
    .eq("status", "processing")
    .select("id,status");

  return verifyNotificationUpdate(id, data, error);
}

async function markFailed(
  serviceClient: ReturnType<typeof createClient>,
  id: string,
  provider: string,
  errorMessage: string,
) {
  const { data, error } = await serviceClient
    .from("notification_logs")
    .update({
      status: "failed",
      provider,
      error_message: errorMessage,
      sent_at: null,
      processing_started_at: null,
    })
    .eq("id", id)
    .eq("status", "processing")
    .select("id,status");

  return verifyNotificationUpdate(id, data, error);
}

async function resetDryRunNotification(serviceClient: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await serviceClient
    .from("notification_logs")
    .update({
      status: "pending",
      sent_at: null,
      provider: null,
      provider_message_id: null,
      error_message: null,
      processing_started_at: null,
    })
    .eq("id", id)
    .eq("status", "processing")
    .select("id,status");

  return verifyNotificationUpdate(id, data, error);
}

function verifyNotificationUpdate(
  expectedId: string,
  data: { id: string; status: string }[] | null,
  error: { message: string } | null,
): NotificationUpdateResult {
  if (error) {
    return {
      ok: false,
      id: expectedId,
      status: null,
      rowCount: 0,
      errorMessage: error.message,
    };
  }

  const rows = data ?? [];
  if (rows.length !== 1) {
    return {
      ok: false,
      id: expectedId,
      status: rows[0]?.status ?? null,
      rowCount: rows.length,
      errorMessage: `Expected exactly one processing notification row to update, but updated ${rows.length}.`,
    };
  }

  return {
    ok: true,
    id: rows[0].id,
    status: rows[0].status,
    rowCount: rows.length,
    errorMessage: null,
  };
}

function logDatabaseUpdateFailure(action: string, result: NotificationUpdateResult) {
  console.error("[SMS processor] Notification database update failed", {
    action,
    notificationLogId: result.id,
    rowCount: result.rowCount,
    status: result.status,
    error: result.errorMessage,
    timestamp: new Date().toISOString(),
  });
}

function logAttempt(
  id: string,
  provider: string,
  success: boolean,
  resultCode: string,
  phone: string,
  simulated: boolean,
) {
  console.log("[SMS processor] Notification attempt", {
    notificationLogId: id,
    provider,
    success,
    resultCode,
    simulated,
    phone: maskPhone(phone),
    timestamp: new Date().toISOString(),
  });
}

function toSafeError(value: string | null) {
  if (!value) return "SMS provider request failed";
  return value.slice(0, 300);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
