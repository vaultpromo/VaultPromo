import "server-only";
import { R2StorageProvider } from "./r2-provider";
import type { StorageProvider } from "./types";

/**
 * Singleton storage provider.
 *
 * Swap R2StorageProvider for a different implementation here and nowhere else.
 * All application code imports `storage` from this file, never from the
 * provider implementation directly.
 */
export const storage: StorageProvider = new R2StorageProvider();

// Re-export types so callers only need to import from "@/lib/storage"
export type {
  StorageProvider,
  BucketName,
  UploadOptions,
  PresignedUrlOptions,
  PresignedUploadOptions,
  DeleteOptions,
  ObjectMetadata,
} from "./types";
