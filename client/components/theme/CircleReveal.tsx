import React from 'react';
import type { Theme } from '@/lib/theme-context';

interface CircleRevealProps {
  active: boolean;
  theme: Theme;
  origin: { x: number; y: number } | null;
  onFinished?: () => void;
}

export const CircleReveal: React.FC<CircleRevealProps> = ({ active, theme, origin, onFinished }) => {
  React.useEffect(() => {
    if (!active || !onFinished) return;
    const timeout = window.setTimeout(() => onFinished(), 900);
    return () => window.clearTimeout(timeout);
  }, [active, onFinished]);

  if (!active || !origin) return null;

  const themeClass = theme === 'light' ? 'circle-reveal-light' : 'circle-reveal-dark';

  return (
    <div className="circle-reveal-overlay">
      <div
        className={`circle-reveal-blob ${themeClass}`}
        style={{ left: origin.x, top: origin.y }}
      />
    </div>
  );
};
