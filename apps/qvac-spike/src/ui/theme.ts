/**
 * Bara design tokens and theme hook.
 * Tokens from Bara-UI-Spec v0.9. Quiet, clean, native. No decorative fire.
 * Colors are candidates; contrast must be measured on real pairings
 * (normal text >= 4.5:1, large/important UI >= 3:1).
 */
import { useColorScheme } from 'react-native';

export interface BaraTheme {
  readonly dark: boolean;
  readonly canvas: string;
  readonly surface: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly actionBg: string;
  readonly actionText: string;
  readonly destructive: string;
  readonly destructiveText: string;
  readonly border: string;
  readonly overlay: string;
}

const LIGHT: BaraTheme = {
  dark: false,
  canvas: '#F7F8FA',
  surface: '#FFFFFF',
  textPrimary: '#17212B',
  textSecondary: '#4B5967',
  actionBg: '#175A46',
  actionText: '#FFFFFF',
  destructive: '#B3261E',
  destructiveText: '#FFFFFF',
  border: '#E2E6EB',
  overlay: 'rgba(15,23,32,0.35)',
};

const DARK: BaraTheme = {
  dark: true,
  canvas: '#121416',
  surface: '#1D2125',
  textPrimary: '#F3F5F7',
  textSecondary: '#BEC7D0',
  actionBg: '#A3E5C8',
  actionText: '#0F1A15',
  destructive: '#FFB4AB',
  destructiveText: '#1A1210',
  border: '#2B3036',
  overlay: 'rgba(0,0,0,0.5)',
};

/** Spacing scale in logical units per spec: 4, 8, 12, 16, 24, 32. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Radii per spec: 12 input, 16 surface. Not everything is a pill. */
export const radius = { input: 12, surface: 16, pill: 999 } as const;

/**
 * Type scale. Body ~16/17, heading 28/32, label 14. Platform default fonts;
 * hierarchy from weight and spacing. Respects the system text-size setting
 * because we do not set allowFontScaling=false and use relative sizes.
 */
export const type = {
  heading: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 17, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};

/** Minimum touch target (Android 48dp; iOS 44pt — use the larger). */
export const MIN_TOUCH = 48;

export function useTheme(): BaraTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}
