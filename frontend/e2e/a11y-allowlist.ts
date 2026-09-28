/**
 * Accessibility violations the scan knowingly lets through.
 *
 * Empty is the goal. Every entry needs a reason a reviewer could disagree
 * with — "the tool is wrong here, because…", or "fixed in #N, which lands
 * next" — and matches one axe rule on selectors containing `selector`, so it
 * cannot quietly swallow the same rule failing somewhere new.
 */
type Allowed = { rule: string; selector: string; reason: string };

export const ALLOWLIST: Allowed[] = [];

export function isAllowed(rule: string, selector: string): boolean {
  return ALLOWLIST.some((entry) => entry.rule === rule && selector.includes(entry.selector));
}
