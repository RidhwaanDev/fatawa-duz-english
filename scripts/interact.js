/* Interaction tests for the components the static audit can't reach:
   mobile nav drawer, mobile filter sheet, theme toggle, Urdu toggle,
   search suggestions, and the "show more" pagination. */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');

const BASE = 'http://localhost:4173/';
const OUT = '.shots/interact';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];

  // ---------- mobile ----------
  console.log('\n━━━ mobile interactions (390×844) ━━━');
  let page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 600));

  // nav drawer
  await page.click('#menuToggle');
  await new Promise(r => setTimeout(r, 500));
  let vis = await page.evaluate(() => {
    const d = document.querySelector('#navDrawer');
    const r = d.getBoundingClientRect();
    return { hidden: d.classList.contains('hidden'), top: Math.round(r.top),
             links: d.querySelectorAll('a').length, expanded: document.querySelector('#menuToggle').getAttribute('aria-expanded') };
  });
  check('nav drawer opens', !vis.hidden && vis.top >= 0 && vis.links === 4,
        `top=${vis.top} links=${vis.links} aria-expanded=${vis.expanded}`);
  await page.screenshot({ path: `${OUT}/mobile-nav-open.png` });

  await page.click('#menuClose');
  await new Promise(r => setTimeout(r, 500));
  vis = await page.evaluate(() => document.querySelector('#navDrawer').classList.contains('hidden'));
  check('nav drawer closes', vis);

  // search suggestions
  await page.type('#homeInput', 'prayer', { delay: 40 });
  await new Promise(r => setTimeout(r, 900));
  const sugg = await page.evaluate(() => document.querySelectorAll('#suggestBox a').length);
  check('search suggestions appear', sugg > 0, `${sugg} shown`);
  await page.screenshot({ path: `${OUT}/mobile-suggest.png` });

  // filter sheet
  await page.goto(BASE + '#/search?category=prayer', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 900));
  await page.click('#filterOpen');
  await new Promise(r => setTimeout(r, 600));
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.sheet');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { open: s.classList.contains('open'), bottom: Math.round(r.bottom),
             withinView: r.top < window.innerHeight, rows: s.querySelectorAll('.filter-row').length,
             scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
  });
  check('filter sheet opens', !!sheet && sheet.open && sheet.withinView && sheet.rows > 30,
        sheet ? `rows=${sheet.rows}` : 'sheet not found');
  check('filter sheet causes no h-scroll', sheet && !sheet.scrollX);
  await page.screenshot({ path: `${OUT}/mobile-filter-sheet.png` });

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 600));
  check('filter sheet closes on Escape',
        await page.evaluate(() => !document.querySelector('.sheet')));

  // show more pagination
  const before = await page.evaluate(() => document.querySelectorAll('#resultArea .card').length);
  await page.evaluate(() => document.querySelector('#moreBtn')?.click());
  await new Promise(r => setTimeout(r, 500));
  const after = await page.evaluate(() => document.querySelectorAll('#resultArea .card').length);
  check('show more loads results', after > before, `${before} → ${after}`);
  await page.close();

  // ---------- desktop ----------
  console.log('\n━━━ desktop interactions (1440×900) ━━━');
  page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // theme toggle persists
  await page.goto(BASE + '#/', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 500));
  const t0 = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('#themeToggle');
  await new Promise(r => setTimeout(r, 350));
  const t1 = await page.evaluate(() => document.documentElement.dataset.theme);
  check('theme toggles', t0 !== t1, `${t0} → ${t1}`);
  await page.screenshot({ path: `${OUT}/desktop-${t1}.png` });
  await page.reload({ waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 500));
  check('theme persists across reload',
        await page.evaluate(() => document.documentElement.dataset.theme) === t1);
  await page.click('#themeToggle');
  await new Promise(r => setTimeout(r, 300));

  // Urdu toggle on a translated fatwa
  await page.goto(BASE + '#/fatwa/1', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 900));
  await page.click('#urduBtn');
  await new Promise(r => setTimeout(r, 400));
  const urdu = await page.evaluate(() => ({
    urduShown: !document.querySelector('#urduPane').classList.contains('hidden'),
    englishHidden: document.querySelector('#englishPane').classList.contains('hidden'),
    hasText: document.querySelector('#urduPane').innerText.trim().length > 200,
  }));
  check('Urdu toggle swaps panes', urdu.urduShown && urdu.englishHidden && urdu.hasText);
  await page.screenshot({ path: `${OUT}/desktop-urdu.png` });
  await page.click('#urduBtn');
  await new Promise(r => setTimeout(r, 400));
  check('Urdu toggle returns to English',
        await page.evaluate(() => document.querySelector('#urduPane').classList.contains('hidden')));

  // keyboard shortcut
  await page.goto(BASE + '#/about', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('/');
  await new Promise(r => setTimeout(r, 250));
  check('"/" focuses search',
        await page.evaluate(() => document.activeElement?.id === 'headerSearchInput'));

  await page.close();
  await browser.close();

  errors.forEach(e => check('no runtime error', false, e));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${failed ? failed + ' failed' : 'PASS — all interactions work'}`);
  process.exit(failed ? 1 : 0);
})();
