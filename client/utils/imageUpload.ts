/**
 * Production-ready image upload utility
 * Handles client-side compression, WebP conversion, and FormData uploads
 * Supports desktop, mobile, and HEIC/HEIF formats
 */

export interface ImageUploadOptions {
  maxWidth?: number;
  quality?: number;
  maxSizeMB?: number;
}

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

const DEFAULT_OPTIONS: Required<ImageUploadOptions> = {
  maxWidth: 1500,
  quality: 0.8,
  maxSizeMB: 10,
};

/**
 * Converts HEIC/HEIF files to a format that can be processed
 * Falls back to original file if conversion fails
 */
async function convertHeicIfNeeded(file: File): Promise<File> {
  // Check if file is HEIC/HEIF
  const isHeic = file.type === 'image/heic' || 
                 file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') ||
                 file.name.toLowerCase().endsWith('.heif');

  if (!isHeic) {
    return file;
  }

  // Try to use heic2any library if available, otherwise use browser's native handling
  // Most modern browsers can handle HEIC through the FileReader API
  try {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = () => reject(new Error('Failed to read HEIC file'));
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onerror = () => {
          // If browser can't handle HEIC, return original and let server handle it
          console.warn('[ImageUpload] Browser cannot process HEIC, sending original file');
          resolve(file);
        };
        
        img.onload = () => {
          // Convert HEIC to canvas, then to blob
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file); // Fallback to original
              return;
            }
            
            const convertedFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            });
            
            resolve(convertedFile);
          }, 'image/jpeg', 0.9);
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.warn('[ImageUpload] HEIC conversion failed, using original:', error);
    return file;
  }
}

/**
 * Compresses and converts image to WebP format
 * Resizes to max width while maintaining aspect ratio
 */
export async function compressImageToWebP(
  file: File,
  options: ImageUploadOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    // Convert HEIC if needed
    const processedFile = await convertHeicIfNeeded(file);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onerror = () => reject(new Error('Failed to load image'));
        
        img.onload = () => {
          try {
            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;
            
            if (width > opts.maxWidth) {
              const ratio = opts.maxWidth / width;
              width = opts.maxWidth;
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
            
            // Use high-quality image rendering
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to WebP blob
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to create WebP blob'));
                  return;
                }
                
                // Check file size
                const sizeMB = blob.size / 1024 / 1024;
                
                if (sizeMB > opts.maxSizeMB) {
                  // Try with lower quality
                  console.warn(`[ImageUpload] Image still large (${sizeMB.toFixed(2)}MB), reducing quality...`);
                  canvas.toBlob(
                    (blob2) => {
                      if (!blob2) {
                        reject(new Error('Failed to create compressed blob'));
                        return;
                      }
                      
                      const compressedFile = new File(
                        [blob2],
                        file.name.replace(/\.[^.]+$/, '.webp'),
                        {
                          type: 'image/webp',
                          lastModified: Date.now(),
                        }
                      );
                      
                      resolve(compressedFile);
                    },
                    'image/webp',
                    Math.max(0.5, opts.quality - 0.2)
                  );
                  return;
                }
                
                // Create File object with WebP extension
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, '.webp'),
                  {
                    type: 'image/webp',
                    lastModified: Date.now(),
                  }
                );
                
                console.log('[ImageUpload] Compressed image:', {
                  original: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
                  compressed: `${(blob.size / 1024 / 1024).toFixed(2)}MB`,
                  dimensions: `${width}x${height}`,
                  reduction: `${(((file.size - blob.size) / file.size) * 100).toFixed(1)}%`,
                });
                
                resolve(compressedFile);
              },
              'image/webp',
              opts.quality
            );
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Image processing failed'));
          }
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.readAsDataURL(processedFile);
    });
  } catch (error) {
    // Fallback: return original file if compression fails
    console.error('[ImageUpload] Compression failed, using original file:', error);
    return file;
  }
}

/**
 * Uploads an image file to the server
 * Automatically compresses and converts to WebP before upload
 */
export async function uploadImage(
  file: File,
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult> {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const isValidType = validTypes.includes(file.type) || 
                       /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);
    
    if (!isValidType) {
      return {
        success: false,
        error: 'Invalid file type. Please upload JPEG, PNG, WebP, or HEIC images.',
      };
    }
    
    // Check initial file size (before compression)
    const initialSizeMB = file.size / 1024 / 1024;
    const maxInitialSizeMB = 200; // Allow up to 200MB before compression
    
    if (initialSizeMB > maxInitialSizeMB) {
      return {
        success: false,
        error: `File is too large (${initialSizeMB.toFixed(2)}MB). Maximum size is ${maxInitialSizeMB}MB.`,
      };
    }
    
    // Compress and convert to WebP
    let processedFile: File;
    try {
      processedFile = await compressImageToWebP(file, options);
    } catch (compressionError) {
      console.error('[ImageUpload] Compression error:', compressionError);
      return {
        success: false,
        error: 'Failed to process image. Please try a different image or contact support.',
      };
    }
    
    // Create FormData
    const formData = new FormData();
    formData.append('image', processedFile);
    
    // Upload to server
    const response = await fetch('/api/products/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      if (response.status === 413) {
        return {
          success: false,
          error: 'Image is too large even after compression. Please keep files under 200MB.',
        };
      }

      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      return {
        success: false,
        error: errorData.error || `Upload failed: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Upload failed',
      };
    }
    
    return {
      success: true,
      url: data.url,
    };
  } catch (error) {
    console.error('[ImageUpload] Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
    };
  }
}

/**
 * Uploads multiple images
 */
export async function uploadImages(
  files: File[],
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult[]> {
  const results: ImageUploadResult[] = [];
  
  for (const file of files) {
    const result = await uploadImage(file, options);
    results.push(result);
  }
  
  return results;
}

