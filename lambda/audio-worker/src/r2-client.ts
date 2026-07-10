import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: false,
});

const ORIGINALS_BUCKET = process.env.R2_BUCKET_ORIGINALS!;
const PREVIEWS_BUCKET = process.env.R2_BUCKET_PREVIEWS!;

/** Download an object from the originals bucket as a Node.js Readable stream */
export async function downloadOriginal(key: string): Promise<Readable> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: ORIGINALS_BUCKET, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`Empty body for key: ${key}`);
  }

  return response.Body as Readable;
}

/** Upload the transcoded MP3 buffer to the previews bucket */
export async function uploadPreview(key: string, buffer: Buffer): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: PREVIEWS_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "audio/mpeg",
      // Cache for 1 year — previews are immutable once created
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}
