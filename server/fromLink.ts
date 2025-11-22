import axios from "axios";

export interface DownloadedImage {
  data: Buffer;
  contentType: string | null;
}

export async function downloadImageFromLink(imageUrl: string): Promise<DownloadedImage> {
  const response = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: "arraybuffer",
    timeout: 15000,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = (response.headers["content-type"] as string | undefined) ?? null;

  return {
    data: Buffer.from(response.data),
    contentType,
  };
}
