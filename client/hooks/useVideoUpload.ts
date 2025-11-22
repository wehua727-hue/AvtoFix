import { useState, useEffect, useCallback } from 'react';

interface VideoData {
  filename: string;
  url?: string;
  size?: number;
}

interface UseVideoUploadReturn {
  // Current state
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoError: string | null;
  existingVideo: VideoData | null;
  
  // Actions
  handleVideoSelect: (file: File) => void;
  handleVideoRemove: () => void;
  setVideoError: (error: string | null) => void;
  loadExistingVideo: (video: VideoData | null) => void;
  clearAll: () => void;
  
  // Computed
  hasVideo: boolean;
  isNewVideo: boolean;
  displayVideo: string | null;
  
  // For form submission
  getVideoPayload: () => Promise<{
    videoFilename?: string;
    videoSize?: number;
    videoBase64?: string;
  }>;
}

export const useVideoUpload = (): UseVideoUploadReturn => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [existingVideo, setExistingVideo] = useState<VideoData | null>(null);

  // Cleanup blob URLs
  const cleanupPreviewUrl = useCallback((url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  // Handle video file selection
  const handleVideoSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      setVideoError('Faqat video fayllar qabul qilinadi');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setVideoError(`${file.name} hajmi 50MB dan oshmasligi kerak`);
      return;
    }

    // Cleanup previous preview URL
    cleanupPreviewUrl(videoPreviewUrl);

    // Create new preview URL
    const newPreviewUrl = URL.createObjectURL(file);
    
    setVideoFile(file);
    setVideoPreviewUrl(newPreviewUrl);
    setExistingVideo(null); // Clear existing video when new one is selected
    setVideoError(null);
  }, [videoPreviewUrl, cleanupPreviewUrl]);

  // Handle video removal
  const handleVideoRemove = useCallback(() => {
    cleanupPreviewUrl(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setExistingVideo(null);
    setVideoError(null);
  }, [videoPreviewUrl, cleanupPreviewUrl]);

  // Load existing video (for edit mode)
  const loadExistingVideo = useCallback((video: VideoData | null) => {
    // Clear any new video data
    cleanupPreviewUrl(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    
    // Set existing video
    setExistingVideo(video);
    setVideoError(null);
  }, [videoPreviewUrl, cleanupPreviewUrl]);

  // Clear all video data
  const clearAll = useCallback(() => {
    cleanupPreviewUrl(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setExistingVideo(null);
    setVideoError(null);
  }, [videoPreviewUrl, cleanupPreviewUrl]);

  // Convert file to base64
  const toBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Get video payload for form submission
  const getVideoPayload = useCallback(async () => {
    const payload: {
      videoFilename?: string;
      videoSize?: number;
      videoBase64?: string;
    } = {};

    // If there's a new video file, process it
    if (videoFile && videoFile.size > 0) {
      payload.videoFilename = videoFile.name;
      payload.videoSize = videoFile.size;
      
      // Convert to base64 if it's a new upload (has blob URL)
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        try {
          payload.videoBase64 = await toBase64(videoFile);
        } catch (error) {
          console.error('Failed to convert video to base64:', error);
          throw new Error('Video yuklashda xatolik yuz berdi');
        }
      }
    }
    // If there's only existing video, include its metadata
    else if (existingVideo) {
      payload.videoFilename = existingVideo.filename;
      payload.videoSize = existingVideo.size;
      // Don't include base64 for existing videos
    }

    return payload;
  }, [videoFile, videoPreviewUrl, existingVideo, toBase64]);

  // Computed values
  const hasVideo = Boolean(videoFile || existingVideo);
  const isNewVideo = Boolean(videoFile && videoPreviewUrl && videoPreviewUrl.startsWith('blob:'));
  const displayVideo = isNewVideo ? videoPreviewUrl : existingVideo?.url || null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPreviewUrl(videoPreviewUrl);
    };
  }, []);

  return {
    // State
    videoFile,
    videoPreviewUrl,
    videoError,
    existingVideo,
    
    // Actions
    handleVideoSelect,
    handleVideoRemove,
    setVideoError,
    loadExistingVideo,
    clearAll,
    
    // Computed
    hasVideo,
    isNewVideo,
    displayVideo,
    
    // For submission
    getVideoPayload,
  };
};