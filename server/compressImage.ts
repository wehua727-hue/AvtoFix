// No-op implementation to avoid native dependency on sharp during packaging
export async function compressImageToJpeg(buffer: Buffer): Promise<Buffer> {
  return buffer;
}
