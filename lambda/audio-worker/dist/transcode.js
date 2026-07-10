import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function resolveFfmpegPath() {
    if (process.env.FFMPEG_PATH)
        return process.env.FFMPEG_PATH;
    // bundled binary: dist/../bin/ffmpeg
    return join(__dirname, "..", "bin", "ffmpeg");
}
ffmpeg.setFfmpegPath(resolveFfmpegPath());
export function transcodeToMp3(inputStream) {
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
            .outputOptions(["-id3v2_version", "3"])
            .on("codecData", (data) => {
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
                try {
                    unlinkSync(outPath);
                }
                catch { /* best-effort cleanup */ }
                resolve({ buffer, durationSeconds });
            }
            catch (err) {
                reject(err);
            }
        });
        command.save(outPath);
    });
}
