/**
 * Bara design tokens and theme hook.
 * Colors aligned with approved Figma design (cyan #B2D9EA, peach #EAC3B2, canvas #F7F7F5, text #11121A).
 * Always serves the approved light pastel theme per user & coordinator instruction.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ViewStyle } from 'react-native';

export interface BaraTheme {
  readonly dark: boolean;
  readonly canvas: string;
  readonly surface: string;
  readonly cyan: string;
  readonly peach: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly actionBg: string;
  readonly actionText: string;
  readonly destructive: string;
  readonly destructiveText: string;
  readonly border: string;
  readonly overlay: string;
  readonly cardShadow: ViewStyle;
}

const LIGHT: BaraTheme = {
  dark: false,
  canvas: '#F7F7F5',
  surface: '#FFFFFF',
  cyan: '#B2D9EA',
  peach: '#EAC3B2',
  textPrimary: '#11121A',
  textSecondary: '#656575',
  textMuted: '#465257',
  actionBg: '#11121A',
  actionText: '#FFFFFF',
  destructive: '#B3261E',
  destructiveText: '#FFFFFF',
  border: '#DFDEE5',
  overlay: 'rgba(17,18,26,0.35)',
  cardShadow: {
    shadowColor: '#121F26',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
};

/** Spacing scale in logical units: 4, 8, 12, 16, 20, 24, 32. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Radii per Figma spec: 16 input, 22-26 card, 999 pill. */
export const radius = { input: 16, card: 24, pill: 999 } as const;

/**
 * Type scale.
 * Heading Figma SF Pro Expanded Regular weight ~410:
 * Uses fontWeight '500' / '400' with subtle letterSpacing rather than heavy 700.
 */
export const type = {
  heading: { fontSize: 26, lineHeight: 32, fontWeight: '500' as const, letterSpacing: 0.2 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '500' as const, letterSpacing: 0.1 },
  section: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  small: { fontSize: 10, lineHeight: 14, fontWeight: '500' as const },
};

/** Minimum touch target (Android 48dp; iOS 44pt — use the larger). */
export const MIN_TOUCH = 48;

/**
 * Approved Figma design specifies light pastel theme (cyan, peach, #F7F7F5).
 * Explicitly returns LIGHT to ensure uniform design regardless of host OS dark mode setting.
 */
export function useTheme(): BaraTheme {
  return LIGHT;
}

/** Hook returning true if user requested reduced motion in OS settings. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (active) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setReduced(v);
    });
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}
