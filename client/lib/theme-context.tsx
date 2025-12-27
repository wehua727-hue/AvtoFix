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
    // Har doim dark theme bilan boshlaymiz
    try {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      // Agar light theme saqlangan bo'lsa, uni ishlatamiz, aks holda dark
      return savedTheme === 'light' ? 'light' : 'dark';
    } catch (error) {
      // localStorage ishlamasa, dark theme
      return 'dark';
    }
  });

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Har doim dark theme bilan boshlaymiz
    const root = document.documentElement;
    
    // Barcha theme class larini olib tashlaymiz
    root.classList.remove('light', 'dark');
    
    // Yangi theme ni qo'shamiz
    root.classList.add(theme);
    
    // localStorage ga saqlash (xatolik bo'lsa ham davom etamiz)
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('Theme localStorage ga saqlanmadi:', error);
    }
  }, [theme]);

  // Component mount bo'lganda ham dark theme ni ta'minlaymiz
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains('dark') && !root.classList.contains('light')) {
      root.classList.add('dark');
    }
  }, []);

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
