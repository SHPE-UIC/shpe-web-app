/**
 * Accessibility violations the scan knowingly lets through.
 *
 * Empty is the goal. Every entry needs a reason a reviewer could disagree
 * with — "the tool is wrong here, because…", or "fixed in #N, which lands
 * next" — and matches one axe rule on the one element carrying `testID`.
 * Not a CSS selector: react-native-web's class names are generated, shared
 * by every element with the same style, and renamed between builds, so an
 * entry keyed on one would either stop matching or quietly swallow the same
 * rule failing somewhere new. A testID is written in the source, per element.
 */
type Allowed = { rule: string; testID: string; reason: string };

export const ALLOWLIST: Allowed[] = [];

/** `html` is axe's markup for the node; only its own opening tag is checked. */
export function isAllowed(rule: string, html: string): boolean {
  const openingTag = html.slice(0, html.indexOf('>') + 1);
  return ALLOWLIST.some(
    (entry) =>
      entry.rule === rule &&
      entry.testID !== '' &&
      openingTag.includes(`data-testid="${entry.testID}"`),
  );
}
