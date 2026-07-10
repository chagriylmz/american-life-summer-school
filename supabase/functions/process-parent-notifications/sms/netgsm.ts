import type { SendSmsInput, SendSmsResult, SmsProvider } from "./types.ts";

type NetgsmConfig = {
  username: string;
  password: string;
  senderId: string;
  dryRun: boolean;
};

const NETGSM_SEND_URL = "https://api.netgsm.com.tr/sms/rest/v2/send";

export function createNetgsmProvider(): SmsProvider {
  const config = readNetgsmConfig();
  return new NetgsmProvider(config);
}

function readNetgsmConfig(): NetgsmConfig {
  const username = Deno.env.get("NETGSM_USERNAME")?.trim() ?? "";
  const password = Deno.env.get("NETGSM_PASSWORD")?.trim() ?? "";
  const senderId = Deno.env.get("NETGSM_HEADER")?.trim() ?? "";
  const dryRun = (Deno.env.get("SMS_DRY_RUN") ?? "true").toLowerCase() === "true";

  if (!senderId) {
    throw new Error("Missing NETGSM_HEADER environment variable");
  }

  if (!dryRun && (!username || !password)) {
    throw new Error("Missing NETGSM_USERNAME or NETGSM_PASSWORD environment variable");
  }

  return { username, password, senderId, dryRun };
}

class NetgsmProvider implements SmsProvider {
  readonly provider = "netgsm";

  constructor(private readonly config: NetgsmConfig) {}

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    if (this.config.dryRun) {
      return {
        success: true,
        provider: this.provider,
        providerMessageId: null,
        providerResponseCode: "dry-run",
        errorMessage: null,
        rawResponse: { dryRun: true },
        simulated: true,
      };
    }

    const payload = {
      msgheader: input.senderId,
      messages: [
        {
          msg: input.message,
          no: input.phone,
        },
      ],
      encoding: "TR",
    };

    try {
      const response = await fetch(NETGSM_SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${this.config.username}:${this.config.password}`)}`,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      const parsed = parseNetgsmResponse(responseText);

      if (!response.ok || !parsed.success) {
        return {
          success: false,
          provider: this.provider,
          providerMessageId: null,
          providerResponseCode: parsed.providerResponseCode,
          errorMessage: parsed.errorMessage ?? `Netgsm request failed with HTTP ${response.status}`,
          rawResponse: { status: response.status, body: responseText },
        };
      }

      return {
        success: true,
        provider: this.provider,
        providerMessageId: parsed.providerMessageId,
        providerResponseCode: parsed.providerResponseCode,
        errorMessage: null,
        rawResponse: { status: response.status, body: responseText },
      };
    } catch (error) {
      return {
        success: false,
        provider: this.provider,
        providerMessageId: null,
        providerResponseCode: null,
        errorMessage: error instanceof Error ? error.message : "Unknown Netgsm request error",
        rawResponse: null,
      };
    }
  }
}

function parseNetgsmResponse(responseText: string) {
  const trimmed = responseText.trim();

  try {
    const json = JSON.parse(trimmed) as {
      code?: string | number;
      jobid?: string | number;
      jobId?: string | number;
      description?: string;
      error?: string;
    };
    const code = String(json.code ?? "");
    const success = code === "00" || code === "0";
    return {
      success,
      providerResponseCode: code || null,
      providerMessageId: json.jobid?.toString() ?? json.jobId?.toString() ?? null,
      errorMessage: success ? null : json.description ?? json.error ?? `Netgsm response code ${code || "unknown"}`,
    };
  } catch {
    const [code, providerMessageId] = trimmed.split(/\s+/);
    const success = code === "00" || code === "0";
    return {
      success,
      providerResponseCode: code || null,
      providerMessageId: success ? providerMessageId ?? null : null,
      errorMessage: success ? null : `Netgsm response code ${code || "unknown"}`,
    };
  }
}
