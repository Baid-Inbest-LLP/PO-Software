import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { lightTheme, darkTheme } from '../../theme';
import { THEME_STORAGE_KEY } from '../../features/ui/uiSlice';

export default function AppProviders({ children }) {
  const theme = useSelector((state) => state.ui.theme);
  const colorScheme = theme === 'dark' ? 'dark' : 'light';
  const isFirstThemeEffect = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    const isThemeChange = !isFirstThemeEffect.current;
    isFirstThemeEffect.current = false;

    if (isThemeChange) {
      root.classList.add('theme-switching');
    }

    root.setAttribute('data-theme', colorScheme);
    localStorage.setItem(THEME_STORAGE_KEY, colorScheme);

    if (!isThemeChange) return undefined;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [colorScheme]);

  return (
    <MantineProvider
      theme={colorScheme === 'dark' ? darkTheme : lightTheme}
      forceColorScheme={colorScheme}
    >
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
