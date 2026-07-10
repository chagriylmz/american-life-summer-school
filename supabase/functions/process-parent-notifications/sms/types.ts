export type SendSmsInput = {
  phone: string;
  message: string;
  senderId: string;
};

export type SendSmsResult = {
  success: boolean;
  provider: string;
  providerMessageId: string | null;
  providerResponseCode?: string | null;
  errorMessage: string | null;
  rawResponse?: unknown;
  simulated?: boolean;
};

export interface SmsProvider {
  readonly provider: string;
  sendSms(input: SendSmsInput): Promise<SendSmsResult>;
}
