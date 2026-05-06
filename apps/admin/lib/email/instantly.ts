import type { EmailProvider, SendInput, SendResult } from '@lwl/shared';

export class InstantlyProvider implements EmailProvider {
  readonly name = 'instantly';
  constructor(private apiKey: string) {}

  async send(input: SendInput): Promise<SendResult> {
    const res = await fetch('https://api.instantly.ai/api/v2/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        'x-idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify({
        to: [{ email: input.to, name: input.toName }],
        from: { email: input.fromAddress, name: input.fromName },
        reply_to: input.replyTo,
        subject: input.subject,
        text: input.textBody,
        html: input.htmlBody,
        headers: input.headers,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`instantly_${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { message_id?: string; id?: string };
    return {
      providerMessageId: json.message_id ?? json.id ?? input.idempotencyKey,
      acceptedAt: new Date().toISOString(),
    };
  }
}
