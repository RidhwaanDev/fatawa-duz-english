/* UI audit: every view at mobile / tablet / desktop.
   Flags horizontal overflow, clipped text, small tap targets, and
   elements escaping the viewport. Writes screenshots to .shots/audit/. */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');

const BASE = 'http://localhost:4173/';
const OUT = '.shots/audit';

const VIEWPORTS = [
  { name: 'mobile',  width: 390,  height: 844,  mobile: true },
  { name: 'tablet',  width: 768,  height: 1024, mobile: false },
  { name: 'desktop', width: 1440, height: 900,  mobile: false },
];

const ROUTES = [
  ['home', '#/'],
  ['search', '#/search?category=prayer'],
  ['search-query', '#/search?q=allah'],
  ['fatwa', '#/fatwa/1'],
  ['browse', '#/browse'],
  ['volume', '#/browse/1'],
  ['about', '#/about'],
];

const audit = () => {
  const issues = [];
  const vw = document.documentElement.clientWidth;

  // 1. page-level horizontal overflow
  if (document.documentElement.scrollWidth > vw + 1) {
    issues.push(`page scrolls horizontally (${document.documentElement.scrollWidth} > ${vw})`);
  }

  const skip = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'HEAD']);
  const els = [...document.querySelectorAll('*')].filter(e =>
    !skip.has(e.tagName)
    && !e.closest('.sr-only')
    && !e.classList.contains('sr-only')
    && !e.closest('[aria-hidden="true"]'));

  for (const el of els) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || !r.height) continue;

    const label = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;

    // 2. element extends past the right edge
    if (r.right > vw + 2 && cs.position !== 'fixed') {
      const parentScrolls = el.closest('[class*="overflow-x-auto"],[class*="overflow-y-auto"]');
      if (!parentScrolls) {
        issues.push(`overflows right by ${Math.round(r.right - vw)}px: ${label}`);
      }
    }

    // 3. text clipped by a fixed height
    if (el.children.length === 0 && el.textContent.trim()) {
      if (el.scrollHeight > el.clientHeight + 3 && cs.overflow === 'hidden'
          && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp.match(/^\d/)) {
        issues.push(`text clipped vertically: ${label}`);
      }
    }

    // 4. tap targets — 44px is the mobile guideline, 28px suffices for a mouse
    const tappable = el.tagName === 'BUTTON'
      || (el.tagName === 'A' && el.getAttribute('href'))
      || el.tagName === 'INPUT';
    if (tappable && r.width > 0) {
      const inline = el.tagName === 'A' && cs.display.includes('inline');
      const min = window.__isMobile ? 44 : 28;
      if (!inline && (r.height < min || r.width < 24)) {
        issues.push(`tap target ${Math.round(r.width)}x${Math.round(r.height)} (<${min}): ${label} "${el.textContent.trim().slice(0, 22)}"`);
      }
    }
  }

  // 5. anything unreadably small
  for (const el of els) {
    if (el.children.length || !el.textContent.trim()) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size && size < 11) {
      issues.push(`font ${size}px too small: ${el.textContent.trim().slice(0, 26)}`);
    }
  }
  return [...new Set(issues)];
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  let total = 0;
  for (const vp of VIEWPORTS) {
    console.log(`\n━━━ ${vp.name} (${vp.width}×${vp.height}) ━━━`);
    for (const [name, hash] of ROUTES) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((m) => { window.__isMobile = m; }, vp.mobile);
      await page.goto(BASE + hash, { waitUntil: 'networkidle', timeout: 45000 });
      await new Promise(r => setTimeout(r, 800));

      const issues = await page.evaluate(audit);
      total += issues.length;
      console.log(`  ${name.padEnd(14)} ${issues.length ? '✗ ' + issues.length : '✓'}`);
      issues.slice(0, 8).forEach(i => console.log(`      · ${i}`));

      await page.screenshot({ path: `${OUT}/${vp.name}-${name}.png`, fullPage: vp.name === 'mobile' });
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n${total === 0 ? 'PASS — no layout issues' : `${total} issue(s) found`}`);
  process.exit(0);
})();
