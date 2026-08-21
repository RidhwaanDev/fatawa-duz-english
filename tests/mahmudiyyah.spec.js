const { test, expect } = require('@playwright/test');

const isMobile = (info) => info.project.name === 'mobile';

/** Fail the test on any console error or failed request. */
function guard(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`${r.failure()?.errorText} ${r.url()}`));
}

test.describe('mahmudiyyah collection', () => {
  test('the tab is reachable and opens the collection', async ({ page }, info) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/');

    if (isMobile(info)) {
      await page.locator('#menuToggle').click();
      await expect(page.locator('#navDrawer')).toBeVisible();
      await page.locator('#navDrawer [data-book="mahmudiyyah"]').click();
    } else {
      await page.locator('header [data-book="mahmudiyyah"]').click();
    }

    await expect(page).toHaveURL(/#\/mahmudiyyah$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fatawa Mahmudiyyah');
    expect(errors).toEqual([]);
  });

  test('landing page reports the collection size, not the other one', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/mahmudiyyah');

    await expect(page.locator('#main')).toContainText('Volume 2');
    await expect(page.locator('#main')).toContainText('4 rulings');
    // The Zakariyya total must never leak into this collection.
    await expect(page.locator('#main')).not.toContainText('3,742');
    expect(errors).toEqual([]);
  });

  test('a ruling shows its citations, signature and scan link', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/mahmudiyyah/fatwa/2');

    await expect(page.locator('#main h1')).toContainText('kalimah');
    await expect(page.locator('#main')).toContainText('Question');
    await expect(page.locator('#main')).toContainText('Ruling');

    // Provenance blocks specific to this collection.
    await expect(page.locator('#main')).toContainText('Works cited in the ruling');
    await expect(page.locator('#main')).toContainText('al-Zalzalah');
    await expect(page.locator('#main')).toContainText('Signed:');
    await expect(page.locator('#main')).toContainText('is a summary');

    const scan = page.locator('#main a', { hasText: 'the original scanned page' }).first();
    await expect(scan).toHaveAttribute('href', /archive\.org.*Vol-02.*page\/n/);

    // Summaries carry no Urdu body, so the toggle must not be offered.
    await expect(page.locator('#urduBtn')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('search stays inside the collection', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/mahmudiyyah/search?q=kalimah');

    const cards = page.locator('#resultArea .card');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });
    await expect(cards.first()).toHaveAttribute('href', /#\/mahmudiyyah\/fatwa\/\d+/);

    await cards.first().click();
    await expect(page).toHaveURL(/#\/mahmudiyyah\/fatwa\/\d+/);
    expect(errors).toEqual([]);
  });

  test('browse lists only this collection\'s volume', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    await page.goto('/#/mahmudiyyah/browse');

    await expect(page.locator('#main')).toContainText('Browse by volume');
    await expect(page.locator('.card')).toHaveCount(1);
    await page.locator('.card').first().click();
    await expect(page).toHaveURL(/#\/mahmudiyyah\/browse\/2/);
    expect(errors).toEqual([]);
  });

  test('switching collections swaps the data cleanly in both directions', async ({ page }) => {
    const errors = [];
    guard(page, errors);

    await page.goto('/#/mahmudiyyah');
    await expect(page.locator('#main')).toContainText('4 rulings');

    await page.goto('/#/');
    await expect(page.locator('#main')).toContainText('3,742');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fatawa Darul Uloom');

    await page.goto('/#/mahmudiyyah');
    await expect(page.locator('#main')).toContainText('4 rulings');
    expect(errors).toEqual([]);
  });

  test('the disclaimer and about page describe summaries, not translation', async ({ page }) => {
    const errors = [];
    guard(page, errors);

    await page.goto('/#/mahmudiyyah/about');
    await expect(page.locator('#main')).toContainText('About this section');
    await expect(page.locator('#main')).toContainText('does not reproduce the book in English');
    await expect(page.locator('.disclaimer')).toContainText('summaries');

    // The default collection keeps its own wording.
    await page.goto('/#/about');
    await expect(page.locator('#main')).toContainText('About this edition');
    expect(errors).toEqual([]);
  });

  test('every entry loads and links to a distinct scanned page', async ({ page }) => {
    const errors = [];
    guard(page, errors);
    const seen = new Set();

    for (const id of [1, 2, 3, 4]) {
      await page.goto(`/#/mahmudiyyah/fatwa/${id}`);
      await expect(page.locator('#main h1')).toBeVisible();
      const href = await page.locator('#main a', { hasText: 'the original scanned page' })
        .first().getAttribute('href');
      expect(href, `entry ${id} needs a scan link`).toMatch(/archive\.org/);
      seen.add(href);
    }
    // pp. 29 and 29 share a page; 31 and 32 do not — expect at least 3 distinct targets.
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('no horizontal overflow on the collection views', async ({ page }) => {
    for (const route of ['#/mahmudiyyah', '#/mahmudiyyah/browse', '#/mahmudiyyah/fatwa/2',
                         '#/mahmudiyyah/about', '#/mahmudiyyah/search?q=faith']) {
      await page.goto('/' + route);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }
  });
});
