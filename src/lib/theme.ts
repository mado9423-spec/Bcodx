import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function current(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : current()));
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#0f0d24' : '#6d4aff');
  }, [theme]);
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('bhub:theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }, [theme]);
  return [theme, toggle];
}
