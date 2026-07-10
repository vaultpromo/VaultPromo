import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StorageProvider, UploadOptions, PresignedUrlOptions } from "@/lib/storage/types";
import { originalTrackKey, previewTrackKey, artworkKey } from "@/lib/storage/keys";

// ── Mock StorageProvider ────────────────────────────────────────────────────

class MockStorageProvider implements StorageProvider {
  private store = new Map<string, { body: Buffer; contentType: string }>();

  async upload(options: UploadOptions): Promise<string> {
    this.store.set(`${options.bucket}:${options.key}`, {
      body: Buffer.from(options.body as Buffer),
      contentType: options.contentType,
    });
    return options.key;
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const exists = this.store.has(`${options.bucket}:${options.key}`);
    if (!exists) throw new Error(`Object not found: ${options.key}`);
    const expiry = options.expiresInSeconds ?? 3600;
    return `https://mock.r2.example.com/${options.bucket}/${options.key}?expires=${expiry}`;
  }

  async getPresignedUploadUrl(options: {
    bucket: string;
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const expiry = options.expiresInSeconds ?? 900;
    return `https://mock.r2.example.com/upload/${options.bucket}/${options.key}?expires=${expiry}`;
  }

  async delete(options: { bucket: string; key: string }): Promise<void> {
    this.store.delete(`${options.bucket}:${options.key}`);
  }

  async getMetadata(options: {
    bucket: string;
    key: string;
  }): Promise<{ key: string; size: number; contentType: string | undefined; lastModified: Date | undefined } | null> {
    const obj = this.store.get(`${options.bucket}:${options.key}`);
    if (!obj) return null;
    return {
      key: options.key,
      size: obj.body.length,
      contentType: obj.contentType,
      lastModified: new Date(),
    };
  }

  /** Test helper — check if object exists */
  has(bucket: string, key: string) {
    return this.store.has(`${bucket}:${key}`);
  }
}

// ── Key generation tests ────────────────────────────────────────────────────

describe("Storage key helpers", () => {
  describe("originalTrackKey", () => {
    it("generates correct key for WAV", () => {
      const key = originalTrackKey("camp-1", "track-1", "audio/wav");
      expect(key).toBe("campaigns/camp-1/tracks/track-1/original.wav");
    });

    it("generates correct key for AIFF", () => {
      const key = originalTrackKey("camp-1", "track-1", "audio/aiff");
      expect(key).toBe("campaigns/camp-1/tracks/track-1/original.aiff");
    });

    it("falls back to .bin for unknown mime types", () => {
      const key = originalTrackKey("camp-1", "track-1", "application/octet-stream");
      expect(key).toBe("campaigns/camp-1/tracks/track-1/original.bin");
    });
  });

  describe("previewTrackKey", () => {
    it("always generates an MP3 key", () => {
      const key = previewTrackKey("camp-1", "track-1");
      expect(key).toBe("campaigns/camp-1/tracks/track-1/preview.mp3");
    });
  });

  describe("artworkKey", () => {
    it("generates correct key for JPEG artwork", () => {
      const key = artworkKey("camp-1", "image/jpeg");
      expect(key).toBe("campaigns/camp-1/artwork.jpg");
    });

    it("generates correct key for PNG artwork", () => {
      const key = artworkKey("camp-1", "image/png");
      expect(key).toBe("campaigns/camp-1/artwork.png");
    });
  });

  it("keys for same campaign but different tracks are unique", () => {
    const key1 = originalTrackKey("camp-1", "track-1", "audio/wav");
    const key2 = originalTrackKey("camp-1", "track-2", "audio/wav");
    expect(key1).not.toBe(key2);
  });

  it("preview key and original key for same track are different", () => {
    const original = originalTrackKey("camp-1", "track-1", "audio/wav");
    const preview = previewTrackKey("camp-1", "track-1");
    expect(original).not.toBe(preview);
  });
});

// ── MockStorageProvider behaviour tests ────────────────────────────────────

describe("StorageProvider contract (via MockStorageProvider)", () => {
  let provider: MockStorageProvider;

  beforeEach(() => {
    provider = new MockStorageProvider();
  });

  it("upload stores the object and returns the key", async () => {
    const key = originalTrackKey("c1", "t1", "audio/wav");
    const returned = await provider.upload({
      bucket: "originals",
      key,
      body: Buffer.from("fake-wav-data"),
      contentType: "audio/wav",
    });

    expect(returned).toBe(key);
    expect(provider.has("originals", key)).toBe(true);
  });

  it("getPresignedUrl returns a URL containing the key and expiry", async () => {
    const key = previewTrackKey("c1", "t1");
    await provider.upload({
      bucket: "previews",
      key,
      body: Buffer.from("fake-mp3"),
      contentType: "audio/mpeg",
    });

    const url = await provider.getPresignedUrl({
      bucket: "previews",
      key,
      expiresInSeconds: 300,
    });

    expect(url).toContain(key);
    expect(url).toContain("300");
  });

  it("getPresignedUrl throws for a non-existent object", async () => {
    await expect(
      provider.getPresignedUrl({ bucket: "originals", key: "does/not/exist.wav" }),
    ).rejects.toThrow("Object not found");
  });

  it("getPresignedUploadUrl uses default 15-minute expiry", async () => {
    const url = await provider.getPresignedUploadUrl({
      bucket: "originals",
      key: "campaigns/c1/tracks/t1/original.wav",
      contentType: "audio/wav",
    });
    expect(url).toContain("900");
  });

  it("delete removes the object", async () => {
    const key = artworkKey("c1", "image/jpeg");
    await provider.upload({
      bucket: "originals",
      key,
      body: Buffer.from("fake-image"),
      contentType: "image/jpeg",
    });

    expect(provider.has("originals", key)).toBe(true);

    await provider.delete({ bucket: "originals", key });

    expect(provider.has("originals", key)).toBe(false);
  });

  it("getMetadata returns correct size and contentType", async () => {
    const key = artworkKey("c1", "image/png");
    const fakeData = Buffer.from("fake-png-data-1234");
    await provider.upload({
      bucket: "originals",
      key,
      body: fakeData,
      contentType: "image/png",
    });

    const meta = await provider.getMetadata({ bucket: "originals", key });

    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(fakeData.length);
    expect(meta!.contentType).toBe("image/png");
  });

  it("getMetadata returns null for missing object", async () => {
    const meta = await provider.getMetadata({ bucket: "originals", key: "missing.wav" });
    expect(meta).toBeNull();
  });

  it("originals and previews buckets are isolated namespaces", async () => {
    const key = "campaigns/c1/tracks/t1/file.wav";
    await provider.upload({
      bucket: "originals",
      key,
      body: Buffer.from("data"),
      contentType: "audio/wav",
    });

    // Same key in "previews" should NOT exist
    expect(provider.has("previews", key)).toBe(false);
    expect(provider.has("originals", key)).toBe(true);
  });
});
