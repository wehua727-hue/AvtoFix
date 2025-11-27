/**
 * Example component demonstrating how to use the image upload utility
 * Copy-paste ready for integration into your product forms
 */

import { useState, useRef } from 'react';
import { uploadImage, uploadImages, ImageUploadResult } from '../utils/imageUpload';

export function ImageUploadExample() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImageUploadResult | null>(null);
  const [results, setResults] = useState<ImageUploadResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const uploadResult = await uploadImage(file, {
        maxWidth: 1500,
        quality: 0.8,
      });

      setResult(uploadResult);

      if (uploadResult.success && uploadResult.url) {
        console.log('Image uploaded successfully:', uploadResult.url);
        // Use uploadResult.url in your product form
      } else {
        console.error('Upload failed:', uploadResult.error);
        alert(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    setResults([]);

    try {
      const uploadResults = await uploadImages(files, {
        maxWidth: 1500,
        quality: 0.8,
      });

      setResults(uploadResults);

      const successful = uploadResults.filter((r) => r.success);
      const failed = uploadResults.filter((r) => !r.success);

      if (successful.length > 0) {
        console.log(`${successful.length} images uploaded successfully`);
        // Use successful URLs in your product form
      }

      if (failed.length > 0) {
        console.error(`${failed.length} uploads failed:`, failed);
        alert(`${failed.length} image(s) failed to upload`);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Image Upload Example</h2>

      {/* Single Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Single Image Upload
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleSingleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploading && <p className="text-sm text-gray-600">Uploading and processing...</p>}
        {result && (
          <div className={`p-3 rounded ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.success ? (
              <div>
                <p className="font-medium">✓ Upload successful!</p>
                <p className="text-sm">URL: {result.url}</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">✗ Upload failed</p>
                <p className="text-sm">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multiple Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Multiple Image Upload
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleMultipleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={`p-2 rounded text-sm ${r.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
              >
                Image {idx + 1}: {r.success ? `✓ ${r.url}` : `✗ ${r.error}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Usage in Product Forms:</h3>
        <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
{`import { uploadImage } from '../utils/imageUpload';

const handleImageSelect = async (file: File) => {
  const result = await uploadImage(file);
  if (result.success) {
    // Use result.url in your product data
    setProductData({ ...productData, imageUrl: result.url });
  }
};`}
        </pre>
      </div>
    </div>
  );
}

