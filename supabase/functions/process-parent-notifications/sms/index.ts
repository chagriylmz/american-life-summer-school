import { createNetgsmProvider } from "./netgsm.ts";
import type { SmsProvider } from "./types.ts";

export function createSmsProvider(): SmsProvider {
  const provider = (Deno.env.get("SMS_PROVIDER") ?? "netgsm").trim().toLowerCase();

  if (provider === "netgsm") {
    return createNetgsmProvider();
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
}
