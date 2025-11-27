# Image Upload Setup - Complete Implementation

This document describes the complete, production-ready image upload system for handling images from desktop and mobile devices.

## Overview

The system provides:
- **Client-side compression** before upload (reduces bandwidth and server load)
- **WebP conversion** for optimal file sizes
- **HEIC/HEIF support** for mobile camera uploads
- **Automatic resizing** to max 1500px width (maintains aspect ratio)
- **Server-side processing** with Sharp for additional safety
- **No strict size limits** (handled gracefully)
- **Error handling** with clear user feedback

## Files Created/Modified

### Frontend
- `client/utils/imageUpload.ts` - Main upload utility with compression
- `client/components/ImageUploadExample.tsx` - Example usage component

### Backend
- `server/upload.ts` - Updated Multer configuration (memoryStorage, no strict limits)
- `server/routes/products.ts` - Enhanced `processProductImageUpload` handler
- `server/index.ts` - Updated error handling and middleware limits

## API Endpoint

**POST `/api/products/upload-image`**

### Request
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: FormData with field name `image`

### Response
```json
{
  "success": true,
  "url": "/uploads/products/1234567890-abc123.webp"
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Usage

### Basic Single Image Upload

```typescript
import { uploadImage } from '../utils/imageUpload';

const handleFileSelect = async (file: File) => {
  const result = await uploadImage(file, {
    maxWidth: 1500,
    quality: 0.8,
  });

  if (result.success) {
    console.log('Image URL:', result.url);
    // Use result.url in your product data
  } else {
    console.error('Upload failed:', result.error);
  }
};
```

### Multiple Image Upload

```typescript
import { uploadImages } from '../utils/imageUpload';

const handleFilesSelect = async (files: File[]) => {
  const results = await uploadImages(files, {
    maxWidth: 1500,
    quality: 0.8,
  });

  const successful = results.filter(r => r.success);
  const urls = successful.map(r => r.url).filter(Boolean);
  
  // Use urls array in your product data
};
```

### React Component Example

```tsx
import { useState } from 'react';
import { uploadImage } from '../utils/imageUpload';

function ProductForm() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result = await uploadImage(file);
    setUploading(false);

    if (result.success && result.url) {
      setImageUrl(result.url);
    } else {
      alert(result.error || 'Upload failed');
    }
  };

  return (
    <form>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        disabled={uploading}
      />
      {uploading && <p>Processing image...</p>}
      {imageUrl && <img src={imageUrl} alt="Preview" />}
    </form>
  );
}
```

## Features

### Client-Side Processing
- ✅ Automatic resizing to max 1500px width
- ✅ Aspect ratio preservation
- ✅ WebP conversion (80% quality)
- ✅ HEIC/HEIF support with fallback
- ✅ File size validation
- ✅ Clear error messages

### Server-Side Processing
- ✅ Multer memoryStorage (no disk I/O during upload)
- ✅ Sharp processing (rotation, resizing, WebP conversion)
- ✅ HEIC/HEIF conversion support
- ✅ Unique filename generation
- ✅ Automatic folder creation
- ✅ Memory cleanup after processing

### Error Handling
- ✅ Invalid file type detection
- ✅ File size validation
- ✅ Compression failure fallback
- ✅ Network error handling
- ✅ Server error handling
- ✅ JSON error responses

## Configuration

### Frontend Options

```typescript
interface ImageUploadOptions {
  maxWidth?: number;      // Default: 1500
  quality?: number;       // Default: 0.8 (80%)
  maxSizeMB?: number;     // Default: 10
}
```

### Backend Configuration

- Max file size: 100MB (before compression)
- Upload directory: `/uploads/products/`
- Output format: WebP
- Output quality: 80%
- Max width: 1500px

## Mobile Support

The system fully supports mobile camera uploads:
- ✅ HEIC/HEIF format support
- ✅ Large file handling
- ✅ Automatic compression
- ✅ Memory-efficient processing
- ✅ Clear error feedback

## Performance Optimizations

1. **Client-side compression** reduces upload time and bandwidth
2. **WebP format** provides 25-35% smaller file sizes vs JPEG
3. **Memory storage** in Multer avoids disk I/O during upload
4. **Sharp concurrency** limited to 2 for optimal memory usage
5. **Automatic cleanup** of file buffers after processing

## Testing

To test the upload system:

1. **Desktop**: Select a JPEG/PNG image from file picker
2. **Mobile**: Take a photo with camera (may be HEIC format)
3. **Large files**: Test with images > 10MB
4. **Multiple files**: Test batch uploads
5. **Error cases**: Test with invalid file types

## Troubleshooting

### "File too large" error
- Client-side compression should handle this
- Check `maxSizeMB` option
- Verify server limits in `server/upload.ts`

### "Upload failed" error
- Check server logs for details
- Verify `/uploads/products/` directory exists
- Check file permissions

### HEIC files not working
- Browser may not support HEIC natively
- Server-side Sharp will handle conversion
- Fallback to original file if needed

## Production Checklist

- ✅ Client-side compression implemented
- ✅ WebP conversion working
- ✅ HEIC/HEIF support added
- ✅ Server-side Sharp processing
- ✅ Error handling complete
- ✅ Memory cleanup implemented
- ✅ Unique filenames generated
- ✅ Folder creation automated
- ✅ No strict size limits
- ✅ JSON error responses

## Notes

- Images are automatically rotated based on EXIF data
- Small images are not upscaled (withoutEnlargement: true)
- All images are converted to WebP format for consistency
- Original file buffers are cleared after processing to save memory

