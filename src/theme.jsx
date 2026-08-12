import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEMES = {
  potter: {
    id: 'potter',
    name: 'Gringotts Gold & Crimson (HP)',
    isDark: true,
    bg: 'bg-[#120306]',
    text: 'text-[#f5ebd6]',
    textMuted: 'text-[#d4af37]/75',
    panel: 'bg-[#22060c]',
    border: 'border-[#d4af37]/35',
    inputBg: 'bg-[#180408]',
    headerBg: 'bg-[#120306]/92',
    buttonPrimary: 'bg-gradient-to-r from-[#d4af37] via-[#f5e5b3] to-[#aa7c11] text-[#120306] font-bold border border-[#f5e5b3] hover:brightness-110 shadow-[0_0_15px_rgba(212,175,55,0.45)] transition-all duration-300',
    buttonSecondary: 'bg-[#2b0a12] hover:bg-[#3d0f1a] border border-[#d4af37]/40 text-[#f5ebd6] hover:text-white transition-all',
    accent: 'amber',
    accentText: 'text-[#d4af37]',
    accentBg: 'bg-[#d4af37]/15',
    accentBorder: 'border-[#d4af37]/60',
    cardBg: 'bg-[#22060c]'
  }
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const potterForced = localStorage.getItem('potter-theme-forced-once-v1');
    if (!potterForced) {
      localStorage.setItem('potter-theme-forced-once-v1', 'true');
      localStorage.setItem('expense-ledger-theme', 'potter');
      return 'potter';
    }
    const saved = localStorage.getItem('expense-ledger-theme');
    return THEMES[saved] ? saved : 'potter';
  });

  const theme = THEMES[currentTheme];

  useEffect(() => {
    localStorage.setItem('expense-ledger-theme', currentTheme);
    if (theme.isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [currentTheme, theme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, theme, setTheme: setCurrentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
