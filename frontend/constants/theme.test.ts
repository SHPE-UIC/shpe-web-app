import { accentPalette } from '../lib/events';
import { colors } from './theme';

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Small text: WCAG 1.4.3 AA. Almost everything in this app is under 18px. */
const AA = 4.5;

/**
 * The accessibility scan (npm run a11y) catches these too, but only on a
 * running stack. The palette is where contrast is actually decided, so it is
 * checked here as well — every text colour, on every surface text sits on.
 */
describe('theme contrast', () => {
  const surfaces = {
    surface: colors.surface,
    background: colors.background,
    divider: colors.divider,
  };
  const textTokens = ['text', 'textMuted', 'textSubtle', 'textFaint', 'iconInactive', 'orangeDark'] as const;

  for (const token of textTokens) {
    for (const [surfaceName, surface] of Object.entries(surfaces)) {
      it(`${token} is readable on ${surfaceName}`, () => {
        expect(contrast(colors[token], surface)).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  // Chips print blue text on a pale blue tint.
  it('blueText is readable on the blue chip tint', () => {
    expect(contrast(colors.blueText, colors.blueTint)).toBeGreaterThanOrEqual(AA);
  });

  // Warnings and "No-show" chips print orangeDark on a pale orange tint.
  it('orangeDark is readable on the orange chip tint', () => {
    expect(contrast(colors.orangeDark, colors.orangeTint)).toBeGreaterThanOrEqual(AA);
  });

  // The events list prints the month and day in white on the tag's colour.
  // Tags are free text, so every colour a tag can land on is checked, not a
  // few sample tags that happen to hash onto them.
  it.each(accentPalette)('white is readable on the %s date tile', (fill) => {
    expect(contrast('#ffffff', fill)).toBeGreaterThanOrEqual(AA);
  });
});
