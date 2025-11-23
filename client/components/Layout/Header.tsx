import { Menu } from 'lucide-react';

interface HeaderProps {
  rightSlot?: React.ReactNode;
  onMenuClick?: () => void;
}

export default function Header({ rightSlot, onMenuClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b shadow-2xl transition-all duration-300 border-red-500/30 bg-gradient-to-r from-gray-900 via-red-950/50 to-gray-900 text-white shadow-red-900/30 backdrop-blur-sm">
      {/* Enhanced animated red glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent animate-pulse"></div>
      {/* Subtle top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-16">
          {/* Left: burger (mobile only) */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex items-center justify-center p-2 rounded-xl transition-all duration-200 lg:hidden flex-shrink-0 text-gray-200 hover:text-white bg-red-950/50 hover:bg-red-900/80 border border-red-600/50 hover:border-red-500/80 shadow-lg hover:shadow-red-900/50"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Center: Logo - centered on mobile, left on desktop */}
          <div className="flex-1 flex items-center justify-center lg:justify-start">
            <div className="relative group">
              <img 
                src="https://chatgpt.com/backend-api/estuary/content?id=file_00000000158471f4ac5755c71e9cbf1f&ts=489962&p=fs&cid=1&sig=a19c72981a6d17f436791ef470bc83566beb7e5507239a25bc5115bfab10a073&v=0" 
                alt="AvtoFix logo" 
                className="h-16 sm:h-20 lg:h-24 xl:h-28 2xl:h-32 w-auto block transition-all duration-300 group-hover:scale-110"
                style={{ 
                  filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 30px rgba(220,38,38,0.6)) brightness(1.4) contrast(1.5) saturate(1.2)',
                  imageRendering: 'crisp-edges',
                  WebkitFilter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 30px rgba(220,38,38,0.6)) brightness(1.4) contrast(1.5) saturate(1.2)'
                }}
                width="auto"
                height="auto"
                onError={(e) => {
                  // Agar URL ishlamasa, eski logoni ko'rsat
                  (e.target as HTMLImageElement).src = '/logo.webp';
                }}
              />
              {/* Enhanced glow effect on hover */}
              <div className="absolute inset-0 -z-0 bg-gradient-to-r from-red-500/30 via-red-600/40 to-red-500/30 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full scale-150"></div>
              {/* Constant subtle glow for better visibility */}
              <div className="absolute inset-0 -z-0 bg-red-500/15 blur-2xl rounded-full scale-125"></div>
            </div>
          </div>

          {/* Right: extra actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Extra actions (printer, Pechat, etc.) */}
            <div className="flex items-center gap-3 sm:gap-4">
              {rightSlot}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
