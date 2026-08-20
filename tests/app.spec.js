const { test, expect } = require('@playwright/test');

const isMobile = (info) => info.project.name === 'mobile';

/** Fail the test on any console error or failed request. */
function guard(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`${r.failure()?.errorText} ${r.url()}`));
}

test.describe('landing page', () => {
  test('renders the collection and its entry points', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fatawa Darul Uloom');
    await expect(page.locator('#main')).toContainText('3,742');
    await expect(page.locator('#homeInput')).toBeVisible();
    await expect(page.locator('.chip').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('search suggestions appear and navigate to a fatwa', async ({ page }) => {
    await page.goto('/');
    await page.locator('#homeInput').fill('prayer');
    const first = page.locator('#suggestBox a').first();
    await expect(first).toBeVisible({ timeout: 20000 });
    await first.click();
    await expect(page).toHaveURL(/#\/fatwa\/\d+/);
    await expect(page.locator('#main h1')).toBeVisible();
  });

  test('submitting the search goes to results', async ({ page }) => {
    await page.goto('/');
    await page.locator('#homeInput').fill('zakat');
    await page.locator('#homeInput').press('Enter');
    await expect(page).toHaveURL(/#\/search\?q=zakat/);
    await expect(page.locator('#resultInput')).toHaveValue('zakat');
  });
});

test.describe('search results', () => {
  test('category filter returns only that category', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/search?category=prayer');

    const cards = page.locator('#resultArea .card');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });
    expect(await cards.count()).toBeGreaterThan(5);
    for (const tag of await page.locator('#resultArea .card .tag').allTextContents()) {
      expect(tag.trim()).toBe('Prayer');
    }
    expect(errors).toEqual([]);
  });

  test('pagination loads more results', async ({ page }) => {
    await page.goto('/#/search?category=prayer');
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });
    const before = await page.locator('#resultArea .card').count();
    await page.locator('#moreBtn').click();
    await expect.poll(() => page.locator('#resultArea .card').count()).toBeGreaterThan(before);
  });

  test('empty result set shows a helpful message', async ({ page }) => {
    await page.goto('/#/search?q=zzzzqqqxyw');
    await expect(page.locator('#resultArea')).toContainText('No fatawa found', { timeout: 20000 });
  });

  test('filters are reachable on every device', async ({ page }, info) => {
    await page.goto('/#/search?category=zakat');
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });

    if (isMobile(info)) {
      await page.locator('#filterOpen').click();
      const sheet = page.locator('.sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.filter-row')).toHaveCount(34);
      await sheet.getByText('Marriage', { exact: true }).click();
    } else {
      await page.locator('#catFilter').getByText('Marriage', { exact: true }).click();
    }
    await expect(page).toHaveURL(/category=marriage/);
    await expect(page.locator('#resultArea .card .tag').first()).toHaveText('Marriage');
  });
});

test.describe('fatwa page', () => {
  test('renders question, answer and preserved Arabic', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/fatwa/1');

    await expect(page.locator('#main h1')).toContainText('reverence');
    await expect(page.locator('#englishPane')).toContainText('Question');
    await expect(page.locator('#englishPane')).toContainText('Answer');

    // Arabic citations must be present, right-to-left, and untranslated.
    const ar = page.locator('.ar-block');
    expect(await ar.count()).toBeGreaterThan(3);
    await expect(ar.first()).toHaveAttribute('dir', 'rtl');
    expect(await ar.first().textContent()).toMatch(/[\u0600-\u06FF]/);
    expect(errors).toEqual([]);
  });

  test('Urdu original toggles in and out', async ({ page }) => {
    await page.goto('/#/fatwa/1');
    await expect(page.locator('#englishPane')).toBeVisible();
    await page.locator('#urduBtn').click();
    await expect(page.locator('#urduPane')).toBeVisible();
    await expect(page.locator('#englishPane')).toBeHidden();
    await expect(page.locator('#urduPane')).toContainText(/[\u0600-\u06FF]/);
    await page.locator('#urduBtn').click();
    await expect(page.locator('#englishPane')).toBeVisible();
  });

  test('previous / next navigation works', async ({ page }) => {
    await page.goto('/#/fatwa/5');
    await page.locator('nav[aria-label="Adjacent fatawa"] a').last().click();
    await expect(page).toHaveURL(/#\/fatwa\/6/);
    await expect(page.locator('#main h1')).toBeVisible();
  });

  test('breadcrumb leads back to the category', async ({ page }) => {
    await page.goto('/#/fatwa/1');
    await page.locator('nav[aria-label="Breadcrumb"] a').last().click();
    await expect(page).toHaveURL(/#\/search\?category=/);
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('browse', () => {
  test('lists nine volumes and drills into one', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/browse');

    await expect(page.locator('#main')).toContainText('Browse by volume');
    await expect(page.locator('.card')).toHaveCount(9);
    await page.locator('.card').first().click();
    await expect(page).toHaveURL(/#\/browse\/1/);
    await expect(page.locator('#main')).toContainText('352 fatawa');

    await page.locator('.card').first().click();
    await expect(page).toHaveURL(/from=\d+&to=\d+/);
    await expect(page.locator('#resultArea .card').first()).toBeVisible({ timeout: 20000 });
    expect(errors).toEqual([]);
  });
});

test.describe('chrome', () => {
  test('theme toggle persists', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('html').getAttribute('data-theme');
    await page.locator('#themeToggle').click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  });

  test('navigation is reachable', async ({ page }, info) => {
    await page.goto('/');
    if (isMobile(info)) {
      await page.locator('#menuToggle').click();
      const drawer = page.locator('#navDrawer');
      await expect(drawer).toBeVisible();
      await drawer.getByRole('link', { name: 'About' }).click();
    } else {
      await page.getByRole('link', { name: 'About' }).first().click();
    }
    await expect(page).toHaveURL(/#\/about/);
    await expect(page.locator('#main')).toContainText('About this edition');
  });

  test('about page explains the Arabic policy', async ({ page }) => {
    await page.goto('/#/about');
    await expect(page.locator('#main')).toContainText('Arabic is never translated');
  });

  test('no horizontal scrolling on any view', async ({ page }) => {
    for (const route of ['#/', '#/search?category=prayer', '#/fatwa/1', '#/browse', '#/browse/1', '#/about']) {
      await page.goto('/' + route);
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }
  });
});
