import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  normalizeEmail,
  normalizeFullName,
  normalizeIsActive,
  normalizeRole,
  normalizeTemporaryPassword,
  normalizeUserId,
} from "./userValidation.ts";

type UserProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  last_active_at: string | null;
};

type CallerProfile = {
  role: string;
  is_active: boolean;
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
    console.error("[manage-users] Unhandled error", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
    return jsonResponse({ error: "Unexpected user management error." }, 500);
  }
});

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const { data: callerProfile, error: callerError } = await serviceClient
    .from("users")
    .select("role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle<CallerProfile>();

  if (callerError) {
    console.error("[manage-users] Caller role lookup failed", {
      userId: authData.user.id,
      error: callerError.message,
    });
    return jsonResponse({ error: "Could not verify authorization." }, 500);
  }

  if (!callerProfile?.is_active || callerProfile.role !== "admin") {
    return jsonResponse({ error: "Forbidden." }, 403);
  }

  const body = await safeReadJson(request);
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "listUsers") {
    return listUsers(serviceClient);
  }

  if (action === "createUser") {
    return createUser(serviceClient, body);
  }

  if (action === "updateUser") {
    return updateUser(serviceClient, body, authData.user.id);
  }

  return jsonResponse({ error: "Unsupported user management action." }, 400);
}

async function listUsers(serviceClient: ReturnType<typeof createClient>) {
  const { data, error } = await serviceClient
    .from("users")
    .select("id, email, full_name, role, is_active, created_at, updated_at, last_login_at, last_active_at")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[manage-users] User list failed", { error: error.message });
    return jsonResponse({ error: "Could not load users." }, 500);
  }

  return jsonResponse({ users: data ?? [] });
}

async function createUser(serviceClient: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  let email: string;
  let fullName: string;
  let role: string;
  let temporaryPassword: string;
  let isActive: boolean;

  try {
    email = normalizeEmail(body.email);
    fullName = normalizeFullName(body.fullName);
    role = normalizeRole(body.role);
    temporaryPassword = normalizeTemporaryPassword(body.temporaryPassword);
    isActive = normalizeIsActive(body.isActive);
  } catch (error) {
    return jsonResponse({ error: getErrorMessage(error) }, 400);
  }

  const { data: existingProfile, error: existingProfileError } = await serviceClient
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    console.error("[manage-users] Duplicate profile lookup failed", {
      email,
      error: existingProfileError.message,
    });
    return jsonResponse({ error: "Could not verify whether this email already exists." }, 500);
  }

  if (existingProfile) {
    return jsonResponse({ error: "A user with this email already exists." }, 409);
  }

  const { data: authCreateData, error: authCreateError } = await serviceClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authCreateError || !authCreateData.user) {
    const isDuplicate = isDuplicateAuthEmailError(authCreateError?.message);
    console.error("[manage-users] Auth user creation failed", {
      email,
      duplicateEmail: isDuplicate,
      error: authCreateError?.message,
    });
    return jsonResponse(
      { error: isDuplicate ? "A user with this email already exists." : "Could not create the login account." },
      isDuplicate ? 409 : 500,
    );
  }

  const authUserId = authCreateData.user.id;
  const { data: insertedProfile, error: insertProfileError } = await serviceClient
    .from("users")
    .insert({
      id: authUserId,
      email,
      full_name: fullName,
      role,
      is_active: isActive,
    })
    .select("id, email, full_name, role, is_active, created_at, updated_at, last_login_at, last_active_at")
    .single<UserProfileRow>();

  if (insertProfileError || !insertedProfile) {
    console.error("[manage-users] Profile creation failed; deleting orphaned auth user", {
      authUserId,
      email,
      error: insertProfileError?.message,
    });

    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(authUserId);
    if (deleteAuthError) {
      console.error("[manage-users] Orphaned auth cleanup failed", {
        authUserId,
        email,
        error: deleteAuthError.message,
      });
    }

    return jsonResponse({ error: "Could not create the app profile. No login was kept." }, 500);
  }

  return jsonResponse({ user: insertedProfile }, 201);
}

async function updateUser(
  serviceClient: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  callerUserId: string,
) {
  let userId: string;
  let role: string | undefined;
  let isActive: boolean | undefined;

  try {
    userId = normalizeUserId(body.userId);
    if (Object.prototype.hasOwnProperty.call(body, "role")) {
      role = normalizeRole(body.role);
    }
    if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
      isActive = normalizeIsActive(body.isActive);
    }
  } catch (error) {
    return jsonResponse({ error: getErrorMessage(error) }, 400);
  }

  if (typeof role === "undefined" && typeof isActive === "undefined") {
    return jsonResponse({ error: "No supported user fields were provided." }, 400);
  }

  if (userId === callerUserId && (role && role !== "admin")) {
    return jsonResponse({ error: "You cannot remove your own admin access." }, 400);
  }

  if (userId === callerUserId && isActive === false) {
    return jsonResponse({ error: "You cannot deactivate your own account." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (typeof role !== "undefined") updates.role = role;
  if (typeof isActive !== "undefined") updates.is_active = isActive;

  const { data: updatedProfile, error: updateError } = await serviceClient
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("id, email, full_name, role, is_active, created_at, updated_at, last_login_at, last_active_at")
    .single<UserProfileRow>();

  if (updateError || !updatedProfile) {
    console.error("[manage-users] User update failed", {
      targetUserId: userId,
      error: updateError?.message,
    });
    return jsonResponse({ error: "Could not update this user." }, 500);
  }

  return jsonResponse({ user: updatedProfile });
}

async function safeReadJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid request.";
}

function isDuplicateAuthEmailError(message: string | undefined) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists");
}
