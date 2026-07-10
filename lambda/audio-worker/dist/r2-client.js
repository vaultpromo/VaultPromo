import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});
const ORIGINALS_BUCKET = process.env.R2_BUCKET_ORIGINALS;
const PREVIEWS_BUCKET = process.env.R2_BUCKET_PREVIEWS;
export async function downloadOriginal(key) {
    const response = await client.send(new GetObjectCommand({ Bucket: ORIGINALS_BUCKET, Key: key }));
    if (!response.Body) {
        throw new Error(`Empty body for key: ${key}`);
    }
    return response.Body;
}
export async function uploadPreview(key, buffer) {
    await client.send(new PutObjectCommand({
        Bucket: PREVIEWS_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000, immutable",
    }));
}
