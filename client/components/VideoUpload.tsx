import React, { useRef, useState } from 'react';

interface VideoData {
  filename: string;
  url?: string;
  size?: number;
}

interface VideoUploadProps {
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoError: string | null;
  existingVideo?: VideoData | null;
  displayVideo: string | null;
  isNewVideo: boolean;
  hasVideo: boolean;
  onVideoSelect: (file: File) => void;
  onVideoRemove: () => void;
  onVideoError: (error: string | null) => void;
  disabled?: boolean;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  videoFile,
  videoError,
  existingVideo,
  displayVideo,
  isNewVideo,
  hasVideo,
  onVideoSelect,
  onVideoRemove,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelect(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      onVideoSelect(file);
    }
  };

  // Determine what to display
  const displayFilename = videoFile?.name || existingVideo?.filename || '';
  const displaySize = videoFile?.size || existingVideo?.size || 0;

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      {!hasVideo && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary hover:bg-primary/5'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-3xl">📁</span>
              <span className="text-2xl">🎬</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Video tanlang</p>
              <p className="text-xs text-muted-foreground mt-1">
                Maksimal hajm: 50MB | Qo'llab-quvvatlanadigan formatlar: MP4, WebM, AVI
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {videoError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {videoError}
        </div>
      )}

      {/* Video Preview */}
      {hasVideo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              {isNewVideo ? 'Yangi video:' : 'Mavjud video:'}
            </p>
            <button
              type="button"
              onClick={() => !disabled && fileInputRef.current?.click()}
              className="text-xs text-primary hover:text-primary/80 underline"
              disabled={disabled}
            >
              Boshqa video tanlash
            </button>
          </div>

          <div className="relative rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden shadow-lg">
            {/* Video Player */}
            {displayVideo && (
              <div className="relative w-full aspect-video bg-black">
                <video
                  controls
                  className="w-full h-full"
                  src={displayVideo}
                  preload="metadata"
                >
                  <source src={displayVideo} type={videoFile?.type || 'video/mp4'} />
                  Brauzeringiz video o'ynatishni qo'llab-quvvatlamaydi.
                </video>
              </div>
            )}
            
            {/* Video Info */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayFilename}</p>
                  {displaySize > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Hajmi: {(displaySize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    {isNewVideo 
                      ? 'Yangi video. Saqlash tugmasini bosing.' 
                      : 'Mavjud video. Yangi video yuklash uchun "Boshqa video tanlash" tugmasini bosing.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onVideoRemove}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm flex items-center justify-center transition-all shadow-lg"
                  disabled={disabled}
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* Hidden input for additional file selection */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};