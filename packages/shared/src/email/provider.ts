export interface SendInput {
  to: string;
  toName?: string | undefined;
  fromAddress: string;
  fromName?: string | undefined;
  replyTo?: string | undefined;
  subject: string;
  textBody: string;
  htmlBody?: string | undefined;
  headers?: Record<string, string> | undefined;
  idempotencyKey: string;
}

export interface SendResult {
  providerMessageId: string;
  acceptedAt: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendInput): Promise<SendResult>;
}
