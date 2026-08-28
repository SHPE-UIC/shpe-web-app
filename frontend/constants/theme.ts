// shared design tokens so every screen pulls from the same palette

import { Platform } from 'react-native';

export const colors = {
  navy: '#001F5B',
  blue: '#0070C0',
  orange: '#FD652F',
  orangeDark: '#D33A02',
  teal: '#72A9BE',

  background: '#f4f6fa',
  surface: '#ffffff',

  text: '#0f1b33',
  textMuted: '#6b7688',
  textSubtle: '#7c869b',
  textFaint: '#a3abbb',

  iconInactive: '#9aa4b6',
  divider: '#f0f2f7',
  border: '#e3e7ee',
} as const;

// navy -> blue, matching the 135deg gradient used across the headers
export const headerGradient = [colors.navy, colors.blue] as const;
export const gradientStart = { x: 0, y: 0 };
export const gradientEnd = { x: 1, y: 1 };

export const radius = {
  card: 22,
  header: 34,
  pill: 20,
  tile: 17,
} as const;

// soft navy-tinted shadow the mockups use on every raised surface
export const shadow = {
  card: Platform.select({
    web: { boxShadow: '0 10px 22px rgba(0, 31, 91, 0.14)' },
    default: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: 5,
    },
  }),
  accent: Platform.select({
    web: { boxShadow: '0 10px 18px rgba(253, 101, 47, 0.45)' },
    default: {
      shadowColor: colors.orange,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
  }),
} as const;
