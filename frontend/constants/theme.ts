// shared design tokens so every screen pulls from the same palette

// Every colour that text is printed in clears WCAG AA (4.5:1) on surface,
// background, and divider — theme.test.ts checks it, and the accessibility scan
// (npm run a11y) checks the rendered screens. Placeholders are text too, and
// use textFaint; axe never looks at them. The brand orange and teal do not
// clear it against white, in either direction, so they stay fills and accents
// and never carry text — nor a white icon that means something (1.4.11 wants
// 3:1, and they give under 3); orangeDark and tealDark are their partners.
export const colors = {
  navy: '#001F5B',
  blue: '#0070C0',
  orange: '#FD652F',
  orangeDark: '#BF3402',
  teal: '#72A9BE',
  tealDark: '#2F6A80',

  /** Blue text on the pale blue chip tint, where `blue` itself falls short. */
  blueText: '#005A9E',
  /** `blue` at 12% over white — the chip background. */
  blueTint: '#e0eef7',

  background: '#f4f6fa',
  surface: '#ffffff',

  // The greys are closer together than they were: below 4.5:1 is unreadable
  // by the standard, so "faint" can only be so faint.
  text: '#0f1b33',
  textMuted: '#525d71',
  textSubtle: '#5f6a7e',
  textFaint: '#646f83',

  iconInactive: '#646f83',
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
  card: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 5,
  },
  accent: {
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;
