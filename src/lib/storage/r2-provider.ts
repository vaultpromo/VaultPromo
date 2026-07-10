import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageProvider,
  BucketName,
  UploadOptions,
  PresignedUrlOptions,
  PresignedUploadOptions,
  DeleteOptions,
  ObjectMetadata,
} from "./types";

/**
 * Resolve an environment bucket name from the logical bucket identifier.
 * Centralises the env-var → bucket-name mapping.
 */
function resolveBucketName(bucket: BucketName): string {
  if (bucket === "originals") {
    const name = process.env.R2_BUCKET_ORIGINALS;
    if (!name) throw new Error("R2_BUCKET_ORIGINALS env var is not set");
    return name;
  }
  const name = process.env.R2_BUCKET_PREVIEWS;
  if (!name) throw new Error("R2_BUCKET_PREVIEWS env var is not set");
  return name;
}

/**
 * Build the Cloudflare R2 S3-compatible endpoint.
 * Format: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 */
function buildR2Endpoint(): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID env var is not set");
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Singleton S3Client pointing at Cloudflare R2.
 * Lazy-initialised so tests that don't exercise storage don't require env vars.
 */
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  _client = new S3Client({
    region: "auto", // R2 uses "auto" as the region
    endpoint: buildR2Endpoint(),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
    // R2 requires path-style addressing
    forcePathStyle: false,
  });

  return _client;
}

export class R2StorageProvider implements StorageProvider {
  /**
   * Upload a file server-side to a private R2 bucket.
   * For large files (WAVs), prefer getPresignedUploadUrl() to stream directly
   * from the browser to R2 without routing through the Next.js process.
   */
  async upload(options: UploadOptions): Promise<string> {
    const client = getClient();
    const bucketName = resolveBucketName(options.bucket);

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: options.key,
        Body: options.body as Buffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
      }),
    );

    return options.key;
  }

  /**
   * Generate a presigned GET URL valid for `expiresInSeconds` (default 1 hour).
   * This is the only way a client can access a private R2 object.
   */
  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = getClient();
    const bucketName = resolveBucketName(options.bucket);
    const expiresIn = options.expiresInSeconds ?? 3600;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: options.key,
    });

    return getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Generate a presigned PUT URL so the browser can upload directly to R2.
   * The Next.js API Route only generates the URL; the binary never touches
   * the Next.js process, keeping memory usage minimal.
   *
   * Default expiry: 15 minutes (enough for a large WAV upload).
   */
  async getPresignedUploadUrl(options: PresignedUploadOptions): Promise<string> {
    const client = getClient();
    const bucketName = resolveBucketName(options.bucket);
    const expiresIn = options.expiresInSeconds ?? 900;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: options.key,
      ContentType: options.contentType,
    });

    return getSignedUrl(client, command, { expiresIn });
  }

  /** Delete an object from a bucket */
  async delete(options: DeleteOptions): Promise<void> {
    const client = getClient();
    const bucketName = resolveBucketName(options.bucket);

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: options.key,
      }),
    );
  }

  /** HEAD request — returns metadata without downloading the body */
  async getMetadata(options: DeleteOptions): Promise<ObjectMetadata | null> {
    const client = getClient();
    const bucketName = resolveBucketName(options.bucket);

    try {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: options.key,
        }),
      );

      return {
        key: options.key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (err) {
      // NoSuchKey or 404 → object doesn't exist
      if ((err as { name?: string }).name === "NotFound") return null;
      throw err;
    }
  }
}
