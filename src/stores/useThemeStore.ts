import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode, ResolvedTheme, ThemeState } from '../types/theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDocument(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: getSystemTheme(),

      setTheme: (theme: ThemeMode) => {
        const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
        applyThemeToDocument(resolved);
        set({ theme, resolvedTheme: resolved });
      },

      toggleTheme: () => {
        const current = get().theme;
        let next: ThemeMode;
        if (current === 'light') next = 'dark';
        else if (current === 'dark') next = 'system';
        else next = 'light';

        const resolved: ResolvedTheme = next === 'system' ? getSystemTheme() : next;
        applyThemeToDocument(resolved);
        set({ theme: next, resolvedTheme: resolved });
      },
    }),
    {
      name: 'vastra-theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved: ResolvedTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
          state.resolvedTheme = resolved;
          applyThemeToDocument(resolved);
        }
      },
    }
  )
);

// Setup system theme listener
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') {
      const resolved = getSystemTheme();
      applyThemeToDocument(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  });
  
  // Initial sync
  const currentTheme = useThemeStore.getState().theme;
  const initialResolved: ResolvedTheme = currentTheme === 'system' 
    ? getSystemTheme() 
    : currentTheme;
  applyThemeToDocument(initialResolved);
}
