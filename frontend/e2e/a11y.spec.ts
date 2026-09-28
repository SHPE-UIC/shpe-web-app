import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { isAllowed } from './a11y-allowlist';
import { SESSION } from './session';
import fixtures from './fixtures.json';

/**
 * WCAG 2.2 A and AA — the level a university is held to. axe's separate
 * "best-practice" rules are left out on purpose: they are advice, and a gate
 * that fails on advice gets switched off.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Screen = {
  name: string;
  path: string;
  /** Text only the loaded screen shows, so an error or redirect cannot pass for it. */
  ready: string | RegExp;
};

const { events, member, announcement } = fixtures;

const SIGNED_OUT: Screen[] = [
  { name: 'login', path: '/', ready: 'Forgot Password?' },
  { name: 'signup', path: '/signup', ready: /Create\s+Account/ },
];

const MEMBER: Screen[] = [
  { name: 'home', path: '/home', ready: 'Dues are open' },
  { name: 'events', path: '/events', ready: 'Resume Workshop' },
  { name: 'event detail', path: `/events-info/${events.upcoming}`, ready: 'About This Event' },
  { name: 'check-in', path: '/check-in', ready: 'Scan the code an organizer is showing' },
  { name: 'profile', path: '/profile', ready: member.email },
  { name: 'announcements', path: '/announcements', ready: 'Dues are open' },
  { name: 'verify email', path: '/verify-email', ready: /Verify\s+Your Email/ },
];

const OFFICER: Screen[] = [
  { name: 'dashboard', path: '/dashboard', ready: 'How the chapter is doing' },
  { name: 'new event', path: '/admin/event', ready: 'New event' },
  { name: 'edit event', path: `/admin/event?id=${events.live}`, ready: 'Edit event' },
  { name: 'new announcement', path: '/admin/announcement', ready: 'New announcement' },
  {
    name: 'edit announcement',
    path: `/admin/announcement?id=${announcement}`,
    ready: 'Edit announcement',
  },
  { name: 'attendance', path: `/admin/attendance?id=${events.past}`, ready: member.name },
  { name: 'members', path: '/admin/members', ready: member.name },
  { name: 'member', path: `/admin/member?id=${member.id}`, ready: member.email },
  { name: 'organizer QR', path: `/organizer/${events.live}`, ready: 'General Body Meeting' },
];

async function expectAccessible(page: Page, screen: Screen) {
  await page.goto(screen.path);
  await expect(page.getByText(screen.ready).first()).toBeVisible({ timeout: 20_000 });
  // Spinners are replaced by content that has not been scanned yet.
  await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 20_000 });

  const { violations, incomplete } = await new AxeBuilder({ page }).withTags(WCAG).analyze();

  const failures = violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !isAllowed(v.id, n.html)) }))
    .filter((v) => v.nodes.length > 0);

  // Contrast axe cannot decide — over a gradient, or a background another
  // element partly covers — comes back "incomplete", not as a violation. It
  // is reported rather than dropped, so a person can check it; it does not
  // fail the screen, because today every one is an icon-font glyph (not text)
  // or white over the navy-to-blue header, which clears 4.5:1 at both ends.
  const undecided = incomplete.filter((v) => v.id === 'color-contrast');
  if (undecided.length > 0) {
    const count = undecided.reduce((sum, v) => sum + v.nodes.length, 0);
    console.log(`${screen.name}: contrast axe could not decide, check by hand:${formatResults(undecided)}`);
    // A workflow command, so it shows on the pull request, not only in the log.
    if (process.env.GITHUB_ACTIONS) {
      console.log(
        `::warning title=a11y contrast to check by hand::${screen.name} (${screen.path}): ` +
          `${count} element(s) axe could not decide; the job log lists them.`,
      );
    }
  }

  expect(
    failures,
    `${screen.name} (${screen.path}) has accessibility violations:${formatResults(failures)}`,
  ).toEqual([]);
}

function formatResults(results: Result[]): string {
  return results
    .map(
      (v) =>
        `\n[${v.impact}] ${v.id}: ${v.help}\n  ${v.helpUrl}\n` +
        v.nodes
          .map(
            (n) =>
              // react-native-web's class names say nothing about which element
              // this is, so the markup goes in too, trimmed to stay readable.
              `  - ${n.target.join(' ')}\n    ${n.html.slice(0, 160)}\n` +
              `    ${n.failureSummary?.replace(/\n/g, '\n    ')}`,
          )
          .join('\n'),
    )
    .join('\n');
}

test.describe('signed out', () => {
  for (const screen of SIGNED_OUT) {
    test(screen.name, async ({ page }) => expectAccessible(page, screen));
  }
});

test.describe('as a member', () => {
  test.use({ storageState: SESSION.member });
  for (const screen of MEMBER) {
    test(screen.name, async ({ page }) => expectAccessible(page, screen));
  }
});

test.describe('as a Top 8', () => {
  test.use({ storageState: SESSION.officer });
  for (const screen of OFFICER) {
    test(screen.name, async ({ page }) => expectAccessible(page, screen));
  }
});
