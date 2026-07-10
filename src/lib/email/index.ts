import "server-only";
import { ResendEmailProvider } from "./resend-provider";
import type { EmailProvider } from "./types";

/**
 * Singleton email provider.
 * Swap ResendEmailProvider for a different implementation here.
 */
export const emailProvider: EmailProvider = new ResendEmailProvider();

export type { EmailProvider, SendEmailOptions, SendEmailResult } from "./types";
