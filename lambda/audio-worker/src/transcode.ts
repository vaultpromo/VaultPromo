import ffmpeg from "fluent-ffmpeg";
import { createWriteStream, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Readable } from "stream";

/**
 * Transcode an audio stream to 128 kbps MP3.
 *
 * Why stream-in / buffer-out:
 * - The source WAV can be very large (100–500 MB). We stream it from R2
 *   directly into FFmpeg without writing it to disk first.
 * - The output MP3 is written to a temp file (ffmpeg requires a seekable
 *   output for MP3 headers), then read back into a Buffer.
 * - Lambda has 512 MB of /tmp by default; a 128kbps MP3 of a 10-minute
 *   track is ~10 MB, well within limits.
 *
 * FFmpeg must be installed in the container at /opt/bin/ffmpeg
 * (included in the Dockerfile via the johnvansickle static build).
 */

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH ?? "/opt/bin/ffmpeg");

export interface TranscodeResult {
  buffer: Buffer;
  durationSeconds: number;
}

export function transcodeToMp3(inputStream: Readable): Promise<TranscodeResult> {
  return new Promise((resolve, reject) => {
    const tmpDir = tmpdir();
    const outPath = join(tmpDir, `${randomUUID()}.mp3`);
    let durationSeconds = 0;

    const command = ffmpeg(inputStream)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .audioFrequency(44100)
      .audioChannels(2)
      // ID3 tags — track-level metadata embedded at transcode time
      .outputOptions(["-id3v2_version", "3"])
      .on("codecData", (data) => {
        // Parse duration from FFmpeg codec info (format: HH:MM:SS.ms)
        const parts = data.duration?.split(":").map(Number) ?? [];
        if (parts.length === 3) {
          durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      })
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .on("end", async () => {
        try {
          const { readFileSync, unlinkSync } = await import("fs");
          const buffer = readFileSync(outPath);
          try { unlinkSync(outPath); } catch { /* best-effort cleanup */ }
          resolve({ buffer, durationSeconds });
        } catch (err) {
          reject(err);
        }
      });

    command.save(outPath);
  });
}
