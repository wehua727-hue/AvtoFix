import { Menu } from 'lucide-react';

interface HeaderProps {
  rightSlot?: React.ReactNode;
  onMenuClick?: () => void;
}

export default function Header({ rightSlot, onMenuClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b shadow-xl transition-colors border-red-500/20 bg-gradient-to-r from-gray-900/98 via-red-950/40 to-gray-900/98 text-white shadow-red-900/20">
      {/* Animated red glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-16">
          {/* Left: burger (mobile only) */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex items-center justify-center p-2 rounded-xl transition-colors lg:hidden flex-shrink-0 text-gray-200 hover:text-white bg-red-950/40 hover:bg-red-900/70 border border-red-600/40"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Center: Logo - centered on mobile, left on desktop */}
          <div className="flex-1 flex items-center justify-center lg:justify-start">
            <img src="/logo.webp" alt="AutoFix logo" width={120}   />
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
