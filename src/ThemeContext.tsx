import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ThemeColors, lightColors, darkColors } from './theme';
import { getSettings, saveSettings } from './storage/storage';
import { AppSettings, DEFAULT_SETTINGS } from './types';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggleDarkMode: () => void;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  toggleDarkMode: () => {},
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    setLoaded(true);
  };

  const toggleDarkMode = useCallback(async () => {
    const updated = { ...settings, darkMode: !settings.darkMode };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const updated = { ...settings, ...partial };
      setSettings(updated);
      await saveSettings(updated);
    },
    [settings],
  );

  const themeColors = settings.darkMode ? darkColors : lightColors;

  if (!loaded) return null; // Prevent flash of wrong theme

  return (
    <ThemeContext.Provider
      value={{
        colors: themeColors,
        isDark: settings.darkMode,
        toggleDarkMode,
        settings,
        updateSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
