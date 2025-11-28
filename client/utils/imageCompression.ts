// Mobile-Friendly Image Compression
// Compresses images before upload to avoid memory issues

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    maxSizeMB = 2, // 2MB max for mobile
  } = options;

  console.log('[ImageCompression] Starting compression:', {
    originalSize: (file.size / 1024 / 1024).toFixed(2) + 'MB',
    fileName: file.name,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.onload = (e) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image'));

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }

              // Check if size is acceptable
              const sizeMB = blob.size / 1024 / 1024;

              console.log('[ImageCompression] Compressed:', {
                newSize: sizeMB.toFixed(2) + 'MB',
                dimensions: `${width}x${height}`,
                reduction: (((file.size - blob.size) / file.size) * 100).toFixed(1) + '%',
              });

              // If still too large, try lower quality
              if (sizeMB > maxSizeMB && quality > 0.5) {
                console.log('[ImageCompression] Still too large, reducing quality...');
                canvas.toBlob(
                  (blob2) => {
                    if (!blob2) {
                      reject(new Error('Failed to create blob'));
                      return;
                    }

                    const compressedFile = new File([blob2], file.name, {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                  },
                  'image/jpeg',
                  quality - 0.2
                );
                return;
              }

              // Create new File object
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  const compressed: File[] = [];

  for (const file of files) {
    try {
      if (file.type.startsWith('image/')) {
        const compressedFile = await compressImage(file, options);
        compressed.push(compressedFile);
      } else {
        compressed.push(file);
      }
    } catch (error) {
      console.error('[ImageCompression] Failed to compress:', file.name, error);
      // Use original file if compression fails
      compressed.push(file);
    }
  }

  return compressed;
}
