import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";

/**
 * Resend email provider implementation.
 * Lazy-initialised singleton — the API key is read at first send,
 * not at module import, so tests that don't exercise email don't require it.
 */

let _client: Resend | null = null;

function getClient(): Resend {
  if (_client) return _client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY env var is not set");
  _client = new Resend(apiKey);
  return _client;
}

export class ResendEmailProvider implements EmailProvider {
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const client = getClient();
    const from = options.from ?? process.env.EMAIL_FROM ?? "noreply@promovault.app";

    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options.idempotencyKey
        ? { headers: { "Idempotency-Key": options.idempotencyKey } }
        : {}),
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return { messageId: data?.id ?? null };
  }
}
