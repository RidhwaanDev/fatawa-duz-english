const { test, expect } = require('@playwright/test');

const PASSWORD = 'hidayah4tamarin';

/** Every test starts from a browser that has never unlocked the collection.
 *  Cleared once here rather than via addInitScript, which would also wipe the
 *  unlock on an in-test reload and defeat the persistence check. */
test.beforeEach(async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
});

test.describe('student collection gate', () => {
  test('is locked by default and hides the collection', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/#/students');
    await expect(page.locator('#unlockInput')).toBeVisible();
    await expect(page.locator('#main')).toContainText('private');
    // No collection content leaks behind the gate.
    await expect(page.locator('#main .card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('rejects a wrong passphrase and stays locked', async ({ page }) => {
    await page.goto('/#/students');
    await page.locator('#unlockInput').fill('not-the-password');
    await page.locator('#unlockForm button[type=submit]').click();
    await expect(page.locator('#unlockError')).toBeVisible();
    await expect(page.locator('#unlockInput')).toBeVisible();
  });

  test('accepts the passphrase, and the unlock persists across a reload', async ({ page }) => {
    await page.goto('/#/students');
    await page.locator('#unlockInput').fill(PASSWORD);
    await page.locator('#unlockForm button[type=submit]').click();

    await expect(page.locator('#unlockInput')).toHaveCount(0);
    await expect(page.locator('#main h1')).toContainText('Student Fatawa');

    await page.reload();
    await expect(page.locator('#unlockInput')).toHaveCount(0);
    await expect(page.locator('#main h1')).toContainText('Student Fatawa');
  });

  test('a deep link into the collection is gated too', async ({ page }) => {
    await page.goto('/#/students/fatwa/1');
    await expect(page.locator('#unlockInput')).toBeVisible();
    await expect(page.locator('#main h1')).not.toContainText('shoes');
  });

  test('gating one collection does not affect the others', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('#unlockInput')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fatawa Darul Uloom');

    await page.goto('/#/mahmudiyyah');
    await expect(page.locator('#unlockInput')).toHaveCount(0);
  });
});

test.describe('student collection content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/students');
    await page.locator('#unlockInput').fill(PASSWORD);
    await page.locator('#unlockForm button[type=submit]').click();
    await expect(page.locator('#unlockInput')).toHaveCount(0);
  });

  test('renders an answer with its Arabic preserved right-to-left', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/#/students/fatwa/1');
    await expect(page.locator('#main h1')).toContainText('shoes');
    await expect(page.locator('#englishPane')).toContainText('Question');
    await expect(page.locator('#englishPane')).toContainText('Answer');

    const ar = page.locator('.ar-block');
    expect(await ar.count()).toBeGreaterThan(0);
    await expect(ar.first()).toHaveAttribute('dir', 'rtl');
    expect(errors).toEqual([]);
  });

  test('carries its own disclaimer wording', async ({ page }) => {
    await expect(page.locator('#disclaimerBody')).toContainText('student training exercises');
    await expect(page.locator('#disclaimerBody')).toContainText('not issued fatawa');
  });

  test('search and category filters work inside the collection', async ({ page }) => {
    await page.goto('/#/students/search?q=shoes');
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#resultArea .card .tag').first()).toHaveText('Prayer');

    await page.goto('/#/students/search?category=prayer');
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });
  });

  test('no horizontal overflow on the collection views', async ({ page }) => {
    for (const route of ['#/students', '#/students/search?category=prayer',
                         '#/students/fatwa/1', '#/students/browse']) {
      await page.goto('/' + route);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }
  });
});

test('the disclaimer lead names it coursework, not AI output', async ({ page }) => {
  await page.goto('/#/students');
  await expect(page.locator('#disclaimerLead')).toHaveText('Student coursework — not a fatwa.');
  await page.goto('/#/');
  await expect(page.locator('#disclaimerLead')).toHaveText('AI-generated — not for citation.');
});
