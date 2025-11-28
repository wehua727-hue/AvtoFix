// No-op image compressor to avoid native dependency (sharp) during packaging.
// Keeps the same API so the rest of the code continues to work.
import sharp from "sharp";

export async function compressImageToBuffer(input: Buffer): Promise<Buffer> {
  sharp.cache(false);
  sharp.concurrency(2);
  return sharp(input, { sequentialRead: true })
    .rotate()
    .resize({ width: 1500, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
