import type { EmailProvider, SendInput, SendResult } from '@lwl/shared';
import { createTransport } from 'nodemailer';

export class MailhogProvider implements EmailProvider {
  readonly name = 'mailhog';
  private transport = createTransport({
    host: 'localhost',
    port: 1025,
    secure: false,
    ignoreTLS: true,
  });

  async send(input: SendInput): Promise<SendResult> {
    const info = await this.transport.sendMail({
      from: input.fromName ? `${input.fromName} <${input.fromAddress}>` : input.fromAddress,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.textBody,
      html: input.htmlBody,
      headers: { ...input.headers, 'X-LWL-Idem': input.idempotencyKey },
    });
    return { providerMessageId: info.messageId, acceptedAt: new Date().toISOString() };
  }
}
