import { z } from "zod";

export const campaignSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters.").max(120).trim(),
  artistName: z.string().min(1, "Artist name is required.").max(120).trim(),
  catalogNumber: z.string().max(40).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  releaseDate: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: "Invalid release date." }),
  expiryDate: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), { message: "Invalid expiry date." }),
});

export const trackSchema = z.object({
  title: z.string().min(1, "Track title is required.").max(200).trim(),
  artistName: z.string().min(1, "Artist name is required.").max(120).trim(),
  mixVersion: z.string().max(80).trim().optional(),
  isrc: z
    .string()
    .max(12)
    .trim()
    .optional()
    .refine((v) => !v || /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(v), {
      message: "ISRC must follow the format CC-XXX-YY-NNNNN.",
    }),
  bpm: z.coerce.number().int().min(40).max(300).optional().nullable(),
  musicalKey: z.string().max(10).trim().optional(),
  position: z.coerce.number().int().min(1).default(1),
});

export const updateTrackKeySchema = z.object({
  trackId: z.string().min(1),
  originalKey: z.string().min(1),
  fileSizeBytes: z.string().optional(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
export type TrackInput = z.infer<typeof trackSchema>;

/** Generic form state for useActionState */
export type CampaignFormState =
  | {
      errors?: Partial<Record<keyof CampaignInput, string[]>>;
      message?: string;
      campaignId?: string;
    }
  | undefined;

export type TrackFormState =
  | {
      errors?: Partial<Record<keyof TrackInput, string[]>>;
      message?: string;
      trackId?: string;
    }
  | undefined;
