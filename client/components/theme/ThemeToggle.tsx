import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { CircleReveal } from './CircleReveal';

export const ThemeToggle: React.FC = () => {
  const { theme, startTransitionTheme } = useTheme();
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [targetTheme, setTargetTheme] = React.useState(theme);
  const [origin, setOrigin] = React.useState<{ x: number; y: number } | null>(null);

  const handleClick = (next: 'light' | 'dark') => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (next === theme || isAnimating) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    setOrigin({ x, y });
    setTargetTheme(next);
    setIsAnimating(true);

    // Theme ni animatsiya davomida yumshoq o'zgartirish
    window.setTimeout(() => {
      startTransitionTheme(next);
    }, 250);
  };

  const handleFinished = () => {
    setIsAnimating(false);
    setOrigin(null);
  };

  const isLight = theme === 'light';

  return (
    <>
      <CircleReveal active={isAnimating} theme={targetTheme} origin={origin} onFinished={handleFinished} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClick('light')}
          className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border text-amber-500 transition-all duration-300 ease-out
            ${isLight
              ? 'bg-amber-100 border-amber-400 shadow-[0_0_40px_rgba(255,255,255,0.4)] scale-105'
              : 'bg-gray-900/40 border-gray-600 hover:bg-gray-800/80 hover:scale-[1.02]'}
          `}
        >
          <Sun className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleClick('dark')}
          className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-300 ease-out
            ${!isLight
              ? 'bg-slate-900 border-slate-500 text-blue-200 shadow-[0_0_40px_rgba(0,0,0,0.5)] scale-105'
              : 'bg-gray-100/80 border-gray-400 text-gray-700 hover:bg-gray-200 hover:scale-[1.02]'}
          `}
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};
