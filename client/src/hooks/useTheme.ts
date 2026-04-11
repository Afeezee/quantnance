import { useContext } from 'react';
import { ThemeContext } from '../contexts/themeContextValue';

export function useTheme() {
  return useContext(ThemeContext);
}
