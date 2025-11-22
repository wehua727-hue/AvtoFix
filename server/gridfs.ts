import { GridFSBucket, ObjectId } from "mongodb";
import { connectMongo } from "./mongo";

/**
 * Save video buffer to MongoDB GridFS
 * @param buffer Video file buffer
 * @param filename Original filename
 * @param contentType MIME type (e.g., 'video/mp4')
 * @returns GridFS file ID
 */
export async function saveVideoToGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string = "video/mp4"
): Promise<string> {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    throw new Error("MongoDB connection not available");
  }

  const bucket = new GridFSBucket(conn.db, { bucketName: "videos" });
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
    });

    uploadStream.on("error", (error) => {
      reject(error);
    });

    uploadStream.on("finish", () => {
      resolve(uploadStream.id.toString());
    });

    uploadStream.end(buffer);
  });
}

/**
 * Get video stream from GridFS by file ID
 * @param fileId GridFS file ID (as string or ObjectId)
 * @returns Readable stream or null if not found
 */
export async function getVideoFromGridFS(fileId: string | ObjectId) {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    return null;
  }

  const bucket = new GridFSBucket(conn.db, { bucketName: "videos" });
  
  try {
    const id = typeof fileId === "string" ? new ObjectId(fileId) : fileId;
    const downloadStream = bucket.openDownloadStream(id);
    return downloadStream;
  } catch (error) {
    console.error("[gridfs] Error getting video:", error);
    return null;
  }
}

/**
 * Delete video from GridFS
 * @param fileId GridFS file ID (as string or ObjectId)
 */
export async function deleteVideoFromGridFS(fileId: string | ObjectId): Promise<boolean> {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    return false;
  }

  const bucket = new GridFSBucket(conn.db, { bucketName: "videos" });
  
  try {
    const id = typeof fileId === "string" ? new ObjectId(fileId) : fileId;
    await bucket.delete(id);
    return true;
  } catch (error) {
    console.error("[gridfs] Error deleting video:", error);
    return false;
  }
}

/**
 * Get video metadata from GridFS
 * @param fileId GridFS file ID (as string or ObjectId)
 * @returns Video metadata or null
 */
export async function getVideoMetadata(fileId: string | ObjectId) {
  const conn = await connectMongo();
  if (!conn || !conn.db) {
    return null;
  }

  const bucket = new GridFSBucket(conn.db, { bucketName: "videos" });
  
  try {
    const id = typeof fileId === "string" ? new ObjectId(fileId) : fileId;
    const files = await bucket.find({ _id: id }).toArray();
    return files[0] || null;
  } catch (error) {
    console.error("[gridfs] Error getting video metadata:", error);
    return null;
  }
}

