import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  onDelete?: (index: number) => void;
  onImageClick?: (index: number) => void;
  className?: string;
  showDeleteButton?: boolean;
  columns?: number; // Number of columns in grid
}

export default function ImageGallery({ 
  images, 
  onDelete, 
  onImageClick,
  className = '',
  showDeleteButton = true,
  columns = 4
}: ImageGalleryProps) {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 rounded-xl border-2 border-dashed border-border bg-muted/30">
        <div className="text-center">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-muted-foreground">Rasmlar yo'q</p>
        </div>
      </div>
    );
  }

  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index);
    } else {
      setFullscreenIndex(index);
    }
  };

  const handlePrevious = () => {
    if (fullscreenIndex !== null && fullscreenIndex > 0) {
      setFullscreenIndex(fullscreenIndex - 1);
    }
  };

  const handleNext = () => {
    if (fullscreenIndex !== null && fullscreenIndex < images.length - 1) {
      setFullscreenIndex(fullscreenIndex + 1);
    }
  };

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <>
      <div className={`grid ${gridCols} gap-3 ${className}`}>
        {images.map((image, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="relative group aspect-square rounded-xl overflow-hidden border-2 border-border bg-muted hover:border-primary transition-all cursor-pointer"
            onClick={() => handleImageClick(index)}
          >
            <img
              src={image}
              alt={`Rasm ${index + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
              loading="lazy"
            />
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Image number badge */}
            <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 text-white text-xs font-semibold">
              {index + 1}
            </div>

            {/* Delete button */}
            {showDeleteButton && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
                className="absolute top-2 right-2 p-2 rounded-lg bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 shadow-lg hover:scale-110 transform transition-all"
                title="Rasmni o'chirish"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {fullscreenIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-sm px-4"
            onClick={() => setFullscreenIndex(null)}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-6xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setFullscreenIndex(null)}
                className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition shadow-lg z-10"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Image */}
              <motion.img
                key={fullscreenIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                src={images[fullscreenIndex]}
                alt={`Rasm ${fullscreenIndex + 1}`}
                className="max-h-[90vh] w-full rounded-2xl object-contain shadow-2xl"
              />

              {/* Navigation buttons */}
              {images.length > 1 && (
                <>
                  {fullscreenIndex > 0 && (
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition shadow-lg"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}
                  
                  {fullscreenIndex < images.length - 1 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 hover:bg-black/90 text-white transition shadow-lg"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </>
              )}

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 text-white text-sm font-semibold">
                {fullscreenIndex + 1} / {images.length}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}