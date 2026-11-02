import { expect, test as setup } from '@playwright/test';
import fixtures from './fixtures.json';
import { SESSION } from './session';

/**
 * Signs in once per account through the real login form, and saves the
 * session for the scan to reuse. Firebase keeps its session in IndexedDB,
 * which is why `indexedDB: true` — cookies and localStorage alone would come
 * back signed out.
 */
for (const role of ['member', 'officer'] as const) {
  setup(`sign in as the ${role}`, async ({ page }) => {
    const account = fixtures[role];

    await page.goto('/');
    await page.getByPlaceholder('you@uic.edu').fill(account.email);
    await page.getByPlaceholder('••••••••').fill(account.password);
    await page.getByPlaceholder('••••••••').press('Enter');

    await page.waitForURL('**/home');
    await expect(page.getByText(`Welcome back, ${account.name.split(' ')[0]}!`)).toBeVisible();

    await page.context().storageState({ path: SESSION[role], indexedDB: true });
  });
}
