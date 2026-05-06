import type { EmailProvider, SendInput, SendResult } from '@lwl/shared';

export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(private apiKey: string) {}

  async send(input: SendInput): Promise<SendResult> {
    const fromHeader = input.fromName
      ? `${input.fromName} <${input.fromAddress}>`
      : input.fromAddress;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: fromHeader,
        to: input.to,
        reply_to: input.replyTo,
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody,
        headers: input.headers,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`resend_${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { id?: string };
    return {
      providerMessageId: json.id ?? input.idempotencyKey,
      acceptedAt: new Date().toISOString(),
    };
  }
}
