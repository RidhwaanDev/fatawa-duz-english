/* Headless smoke test: loads every view, fails on console/page errors,
   and writes screenshots to .shots/ for visual review. */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');

const BASE = 'http://localhost:4173/';
const OUT = '.shots';

const ROUTES = [
  ['home', '#/'],
  ['search', '#/search?q=zakat'],
  ['search-filtered', '#/search?category=prayer'],
  ['fatwa', '#/fatwa/1'],
  ['fatwa-arabic', '#/fatwa/3'],
  ['browse', '#/browse'],
  ['browse-volume', '#/browse/1'],
  ['about', '#/about'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  const errors = [];
  let failed = false;

  for (const [name, hash] of ROUTES) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`);
    });
    page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
    page.on('requestfailed', r => errors.push(`[${name}] requestfailed: ${r.url()}`));

    await page.goto(BASE + hash, { waitUntil: 'networkidle', timeout: 45000 });
    await new Promise(r => setTimeout(r, 900));

    const info = await page.evaluate(() => ({
      text: (document.querySelector('#main')?.innerText || '').slice(0, 180).replace(/\s+/g, ' '),
      len: (document.querySelector('#main')?.innerText || '').length,
      arBlocks: document.querySelectorAll('.ar-block').length,
      cards: document.querySelectorAll('.card').length,
      h1: document.querySelector('h1')?.innerText || '',
    }));

    if (info.len < 60) { failed = true; errors.push(`[${name}] rendered almost nothing`); }
    console.log(`${name.padEnd(16)} chars=${String(info.len).padEnd(6)} cards=${String(info.cards).padEnd(4)} ar=${info.arBlocks}  ${info.text.slice(0, 70)}`);

    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    // dark variant of the landing page only
    if (name === 'home') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await new Promise(r => setTimeout(r, 350));
      await page.screenshot({ path: `${OUT}/home-dark.png` });
    }
    await page.close();
  }

  // interaction test: typing in the landing search shows suggestions
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on('pageerror', e => errors.push(`[interaction] pageerror: ${e.message}`));
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#homeInput');
  await page.type('#homeInput', 'divorce', { delay: 45 });
  await new Promise(r => setTimeout(r, 1200));
  const sugg = await page.evaluate(() =>
    document.querySelectorAll('#suggestBox a').length);
  console.log(`suggestions      count=${sugg}`);
  if (!sugg) { failed = true; errors.push('[interaction] no search suggestions appeared'); }
  await page.screenshot({ path: `${OUT}/home-suggest.png` });
  await page.close();

  await browser.close();

  if (errors.length) {
    console.log('\nISSUES:');
    errors.forEach(e => console.log('  ' + e));
  }
  console.log(failed || errors.length ? '\nFAIL' : '\nPASS — all views rendered cleanly');
  process.exit(failed || errors.length ? 1 : 0);
})();
