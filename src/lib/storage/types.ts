/**
 * StorageProvider interface — abstracts the underlying object store.
 *
 * All methods operate on "keys" (object paths inside a bucket), never on
 * public URLs. The only way to serve a file is via a time-limited presigned URL
 * generated server-side.
 *
 * Current implementation: Cloudflare R2 (S3-compatible).
 * Swappable to AWS S3 or any S3-compatible store by replacing the provider.
 */

export type BucketName = "originals" | "previews";

export interface UploadOptions {
  bucket: BucketName;
  key: string;
  body: Buffer | Uint8Array | ReadableStream;
  contentType: string;
  /** Optional metadata tags written to the object */
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  bucket: BucketName;
  key: string;
  /** Expiry in seconds. Default: 3600 (1 hour) */
  expiresInSeconds?: number;
}

export interface PresignedUploadOptions {
  bucket: BucketName;
  key: string;
  contentType: string;
  /** Expiry in seconds. Default: 900 (15 min) */
  expiresInSeconds?: number;
  /** Max allowed file size in bytes */
  maxSizeBytes?: number;
}

export interface DeleteOptions {
  bucket: BucketName;
  key: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string | undefined;
  lastModified: Date | undefined;
}

export interface StorageProvider {
  /**
   * Upload a file to the private bucket.
   * Returns the object key (not a URL).
   */
  upload(options: UploadOptions): Promise<string>;

  /**
   * Generate a time-limited presigned GET URL for a private object.
   * Use this to stream audio or serve artwork to an authenticated client.
   */
  getPresignedUrl(options: PresignedUrlOptions): Promise<string>;

  /**
   * Generate a time-limited presigned PUT URL.
   * Use this to let the client upload directly from the browser to R2,
   * bypassing the Next.js server for large files (WAV uploads).
   */
  getPresignedUploadUrl(options: PresignedUploadOptions): Promise<string>;

  /**
   * Delete an object from the bucket.
   */
  delete(options: DeleteOptions): Promise<void>;

  /**
   * Retrieve metadata for an object without downloading its body.
   */
  getMetadata(options: DeleteOptions): Promise<ObjectMetadata | null>;
}
