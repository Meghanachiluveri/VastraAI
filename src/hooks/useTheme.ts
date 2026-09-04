import { useThemeStore } from '../stores/useThemeStore';

export function useTheme() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useThemeStore();
  const isDark = resolvedTheme === 'dark';

  return {
    theme,
    resolvedTheme,
    isDark,
    setTheme,
    toggleTheme,
  };
}
