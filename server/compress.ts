// No-op image compressor to avoid native dependency (sharp) during packaging.
// Keeps the same API so the rest of the code continues to work.
export async function compressImageToBuffer(input: Buffer): Promise<Buffer> {
  return input;
}
