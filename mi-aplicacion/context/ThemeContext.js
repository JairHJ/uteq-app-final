import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const THEMES = {
  light: {
    name: 'light',
    colors: {
      background: '#f8fafc',
      card: '#ffffff',
      cardAlt: '#f1f5f9',
      text: '#0f172a',
      textSecondary: '#475569',
      border: '#e2e8f0',
      primary: '#0ea5e9',
      danger: '#ef4444',
    }
  },
  dark: {
    name: 'dark',
    colors: {
      background: '#0f172a',
      card: '#1e293b',
      cardAlt: '#334155',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: '#334155',
      primary: '#38bdf8',
      danger: '#f87171',
    }
  }
};

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('light');
  const [theme, setTheme] = useState(THEMES.light);

  const applyTheme = useCallback((name) => {
    const next = THEMES[name] ? name : 'light';
    setThemeName(next);
    setTheme(THEMES[next]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('preferences');
        if (stored) {
          const prefs = JSON.parse(stored);
            if (prefs.theme) applyTheme(prefs.theme);
        }
      } catch {}
    })();
  }, [applyTheme]);

  const toggleTheme = async () => {
    const next = themeName === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try {
      const stored = await AsyncStorage.getItem('preferences');
      const prefs = stored ? JSON.parse(stored) : {};
      prefs.theme = next;
      await AsyncStorage.setItem('preferences', JSON.stringify(prefs));
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setThemeName: applyTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
