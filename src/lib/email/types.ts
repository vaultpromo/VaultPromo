/**
 * EmailProvider interface — abstracts the underlying transactional email service.
 *
 * Current implementation: Resend.
 * Swap by replacing the provider in src/lib/email/index.ts.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  /** Fully rendered HTML string */
  html: string;
  /** Plain-text fallback */
  text: string;
  /** From address — defaults to EMAIL_FROM env var */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
  /** Optional idempotency key (used by Resend to prevent duplicates) */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  messageId: string | null;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
}
