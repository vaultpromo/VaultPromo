import { z } from "zod";

export const mailingListSchema = z.object({
  name: z.string().min(2, "List name must be at least 2 characters.").max(120).trim(),
  description: z.string().max(500).trim().optional(),
});

export type MailingListInput = z.infer<typeof mailingListSchema>;

export type MailingListFormState =
  | {
      errors?: Partial<Record<keyof MailingListInput, string[]>>;
      message?: string;
      listId?: string;
    }
  | undefined;
