import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Загружаем тему из localStorage при инициализации
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    return savedTheme || 'dark';
  });

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Применяем тему к документу
    // Плавный переход обеспечивается CSS transitions в global.css
    const root = document.documentElement;
    
    // Удаляем старую тему и добавляем новую
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    // Сохраняем в localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    if (newTheme === theme || isAnimating) return;
    
    setIsAnimating(true);
    setThemeState(newTheme);
    
    // Сбрасываем флаг анимации через 800ms
    setTimeout(() => {
      setIsAnimating(false);
    }, 800);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
