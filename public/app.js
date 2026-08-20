/* Fatawa Darul Uloom Zakariyya — English edition
   Plain ES2020, no framework, no build step for this file. */
(() => {
'use strict';

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
const $  = (sel, root = document) => root.querySelector(sel);
const main = $('#main');

const RTL_CHAR  = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RTL_RUN   = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\d.,:;()[\]/«»\u060C\u061B\u061F\u06D4'"-]*[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nfmt  = (n) => n.toLocaleString('en-US');

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */
const state = {
  meta: null,
  index: null,
  indexPromise: null,
  route: { name: 'home', params: {} },
  fatwaCache: new Map(),
};

const dataUrl = (p) => `./data/${p}`;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const loadMeta  = () => state.meta ? Promise.resolve(state.meta)
  : getJSON(dataUrl('meta.json')).then(m => (state.meta = m));

function loadIndex() {
  if (state.index) return Promise.resolve(state.index);
  if (!state.indexPromise) {
    state.indexPromise = getJSON(dataUrl('index.json')).then(ix => {
      ix.n = ix.id.length;
      state.index = ix;
      return ix;
    });
  }
  return state.indexPromise;
}

function loadFatwa(id) {
  if (state.fatwaCache.has(id)) return Promise.resolve(state.fatwaCache.get(id));
  return getJSON(dataUrl(`fatwa/${id}.json`)).then(f => {
    state.fatwaCache.set(id, f);
    return f;
  });
}

const catName = (slug) =>
  (state.meta?.categories.find(c => c.slug === slug) || {}).name || 'Miscellaneous';

/* ------------------------------------------------------------------ */
/*  Text rendering — English prose with verbatim Arabic preserved      */
/* ------------------------------------------------------------------ */

/** A paragraph is a standalone Arabic quotation when it is right-to-left
 *  script with essentially no English around it. */
function isArabicBlock(text) {
  if (!RTL_CHAR.test(text)) return false;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const rtl   = (text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  return rtl > 8 && latin <= Math.max(2, rtl * 0.06);
}

/** Wrap inline right-to-left runs so they render correctly inside English. */
function wrapInlineRtl(escaped) {
  return escaped.replace(RTL_RUN, (m) =>
    m.trim().length < 1 ? m : `<span class="ar-inline">${m}</span>`);
}

function highlightHtml(html, terms) {
  if (!terms.length) return html;
  const re = new RegExp(`(${terms.map(escRe).join('|')})`, 'gi');
  return html.split(/(<[^>]+>)/).map(part =>
    part.startsWith('<') ? part : part.replace(re, '<mark>$1</mark>')
  ).join('');
}

function renderProse(text, terms = []) {
  const paras = String(text || '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => {
    if (isArabicBlock(p)) {
      return `<div class="ar-block" dir="rtl" lang="ar">${esc(p)}</div>`;
    }
    let html = wrapInlineRtl(esc(p));
    if (terms.length) html = highlightHtml(html, terms);
    return `<p>${html}</p>`;
  }).join('');
}

function renderUrdu(text) {
  return String(text || '').split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p class="mb-4">${esc(p)}</p>`).join('');
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */
function tokenize(q) {
  return (q.toLowerCase().match(/[a-z0-9']+/g) || []).filter(t => t.length > 1);
}

function runSearch(q, filters = {}) {
  const ix = state.index;
  if (!ix) return [];
  const terms  = tokenize(q);
  const phrase = q.toLowerCase().trim();
  const usePhrase = phrase.length > 4 && terms.length > 1;
  const out = [];

  for (let i = 0; i < ix.n; i++) {
    if (filters.category && ix.c[i] !== filters.category) continue;
    if (filters.volume   && ix.v[i] !== filters.volume)   continue;
    if (filters.from && (ix.id[i] < filters.from || ix.id[i] > filters.to)) continue;

    if (!terms.length) { out.push({ i, score: 0 }); continue; }

    const title = ix.t[i].toLowerCase();
    const key   = ix.k[i];
    let score = 0, matched = 0;

    for (const term of terms) {
      let s = 0;
      const inTitle = title.includes(term);
      const inKey   = key.includes(term);
      if (inTitle) {
        s += 16;
        if (new RegExp(`\\b${escRe(term)}`).test(title)) s += 8;
      }
      if (inKey) {
        s += 5;
        if (new RegExp(`\\b${escRe(term)}`).test(key)) s += 3;
      }
      if (s) matched++;
      score += s;
    }
    // Every term must appear somewhere.
    if (matched < terms.length) continue;

    if (usePhrase) {
      if (title.includes(phrase)) score += 70;
      else if (key.includes(phrase)) score += 28;
    }
    if (title.startsWith(terms[0])) score += 10;
    score -= Math.min(6, title.length / 90);   // gently favour tighter titles

    out.push({ i, score });
  }

  out.sort((a, b) => b.score - a.score || ix.id[a.i] - ix.id[b.i]);
  return out;
}

/* ------------------------------------------------------------------ */
/*  Routing                                                            */
/* ------------------------------------------------------------------ */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const p = new URLSearchParams(qs || '');
  const seg = path.split('/').filter(Boolean);

  if (seg[0] === 'fatwa' && seg[1]) return { name: 'fatwa', params: { id: Number(seg[1]) } };
  if (seg[0] === 'browse') return { name: 'browse', params: { volume: seg[1] ? Number(seg[1]) : null } };
  if (seg[0] === 'about')  return { name: 'about', params: {} };
  if (seg[0] === 'search') return {
    name: 'search',
    params: {
      q: p.get('q') || '',
      category: p.get('category') || '',
      volume: p.get('volume') ? Number(p.get('volume')) : 0,
      from: p.get('from') ? Number(p.get('from')) : 0,
      to: p.get('to') ? Number(p.get('to')) : 0,
      label: p.get('label') || '',
    }
  };
  return { name: 'home', params: {} };
}

function searchHref({ q = '', category = '', volume = 0, from = 0, to = 0, label = '' }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (category) p.set('category', category);
  if (volume) p.set('volume', String(volume));
  if (from) { p.set('from', String(from)); p.set('to', String(to)); }
  if (label) p.set('label', label);
  const s = p.toString();
  return `#/search${s ? '?' + s : ''}`;
}

function go(href, replace = false) {
  if (replace) history.replaceState(null, '', href);
  else location.hash = href.replace(/^#/, '');
  if (replace) render();
}

/* ------------------------------------------------------------------ */
/*  Shared view pieces                                                 */
/* ------------------------------------------------------------------ */
function skeletonList(n = 6) {
  return `<div class="space-y-3">${Array.from({ length: n }, () => `
    <div class="rounded-[var(--radius-card)] border p-5" style="border-color: var(--color-line)">
      <div class="skel h-3 w-24"></div>
      <div class="skel mt-3 h-4 w-3/4"></div>
      <div class="skel mt-3 h-3 w-full"></div>
      <div class="skel mt-2 h-3 w-5/6"></div>
    </div>`).join('')}</div>`;
}

function resultCard(i, terms) {
  const ix = state.index;
  const id = ix.id[i];
  const pending = !ix.e[i];
  let snip = wrapInlineRtl(esc(ix.s[i]));
  if (terms.length) snip = highlightHtml(snip, terms);
  let title = esc(ix.t[i]);
  if (terms.length) title = highlightHtml(title, terms);

  return `<a class="card group" href="#/fatwa/${id}">
    <div class="mb-2 flex flex-wrap items-center gap-2">
      <span class="tag">${esc(catName(ix.c[i]))}</span>
      <span class="text-[11.5px]" style="color: var(--color-faint)">
        Volume ${ix.v[i]} · No. ${id}
      </span>
      ${pending ? '<span class="text-[11.5px]" style="color: var(--color-faint)">· translation pending</span>' : ''}
    </div>
    <h3 class="display text-[19px] leading-snug transition-colors duration-200${pending ? ' ur-text !text-[20px]' : ''}"
        ${pending ? 'dir="rtl"' : ''} style="color: var(--color-ink)">${title}</h3>
    <p class="mt-2 text-[14px] leading-relaxed${pending ? ' ur-text !text-[15px]' : ''}"
       ${pending ? 'dir="rtl"' : ''} style="color: var(--color-muted)">${snip}</p>
  </a>`;
}

function emptyState(title, body) {
  return `<div class="anim-rise py-20 text-center">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"
         class="mx-auto mb-4" style="color: var(--color-faint)" aria-hidden="true">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/>
    </svg>
    <p class="display text-[21px]">${esc(title)}</p>
    <p class="mx-auto mt-2 max-w-sm text-[14px]" style="color: var(--color-muted)">${esc(body)}</p>
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  View: home                                                         */
/* ------------------------------------------------------------------ */
function viewHome() {
  const m = state.meta;
  const top = m.categories.filter(c => c.slug !== 'misc').slice(0, 10);

  main.innerHTML = `
  <section class="wrap flex flex-col items-center pt-20 pb-16 sm:pt-28">
    <p class="eyebrow anim-fade">Nine volumes · ${nfmt(m.total)} rulings</p>

    <h1 class="display anim-rise mt-5 text-center text-[38px] leading-[1.08] sm:text-[56px]"
        style="animation-delay:.04s">
      Fatawa Darul Uloom<br>Zakariyya
    </h1>

    <p class="anim-rise mt-5 max-w-lg text-center text-[16px] leading-relaxed"
       style="color: var(--color-muted); animation-delay:.09s">
      The complete fatwa collection, translated from the original Urdu into English.
      Arabic citations are preserved exactly as they appear in the source.
    </p>

    <div class="anim-rise relative z-20 mt-10 w-full max-w-xl" style="animation-delay:.14s">
      <form id="homeForm" class="search-shell" role="search">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             class="shrink-0" style="color: var(--color-faint)" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/>
        </svg>
        <input id="homeInput" type="search" placeholder="Search the fatawa…"
               aria-label="Search fatawa" autocomplete="off" spellcheck="false">
        <kbd class="hidden shrink-0 rounded border px-1.5 py-0.5 text-[11px] sm:block"
             style="border-color: var(--color-line); color: var(--color-faint)">/</kbd>
      </form>
      <div id="suggestBox"
           class="absolute left-0 right-0 top-[calc(100%+8px)] z-30 hidden overflow-hidden rounded-[var(--radius-card)] border"
           style="background: var(--color-raised); border-color: var(--color-line);
                  box-shadow: 0 20px 50px -24px rgba(23,21,18,.45)"></div>
    </div>

    <div class="anim-rise relative z-0 mt-9 flex max-w-3xl flex-wrap justify-center gap-2"
         style="animation-delay:.19s">
      ${top.map(c => `<a class="chip" href="${searchHref({ category: c.slug })}">
        ${esc(c.name)} <span class="chip-count">${c.count}</span></a>`).join('')}
      <a class="chip" href="#/browse">All categories →</a>
    </div>
  </section>

  <section class="wrap pb-6">
    <div class="rule"></div>
    <div class="mt-8 grid gap-8 sm:grid-cols-3">
      ${[
        ['Faithful to the source', 'Every Qur\u2019anic verse, hadith and citation from the classical fiqh works is reproduced verbatim in Arabic, never translated.'],
        ['Plain English', 'Rulings are rendered in clear, natural English so they can be read without specialist training.'],
        ['Search across everything', `All ${nfmt(m.total)} fatawa are indexed and searchable instantly, filterable by topic and volume.`],
      ].map(([h, b], k) => `
        <div class="anim-rise" style="animation-delay:${.05 * k + .05}s">
          <h3 class="display text-[17px]">${h}</h3>
          <p class="mt-2 text-[14px] leading-relaxed" style="color: var(--color-muted)">${b}</p>
        </div>`).join('')}
    </div>
  </section>`;

  wireHomeSearch();
}

function wireHomeSearch() {
  const input = $('#homeInput');
  const box   = $('#suggestBox');
  const form  = $('#homeForm');
  let items = [], active = -1;

  const close = () => { box.classList.add('hidden'); active = -1; };

  const paint = () => {
    if (!items.length) return close();
    box.innerHTML = items.map((r, k) => {
      const ix = state.index;
      return `<a href="#/fatwa/${ix.id[r.i]}" data-k="${k}"
         class="flex items-start gap-3 border-b px-4 py-3 text-left transition-colors duration-150 last:border-0"
         style="border-color: var(--color-line-soft); ${k === active ? 'background: var(--color-sunk);' : ''}">
        <span class="tag mt-0.5 shrink-0">${esc(catName(ix.c[r.i]))}</span>
        <span class="min-w-0 flex-1 text-[14px] leading-snug">${esc(ix.t[r.i])}</span>
      </a>`;
    }).join('');
    box.classList.remove('hidden');
  };

  const update = debounce(() => {
    const q = input.value.trim();
    if (q.length < 2) { items = []; return close(); }
    loadIndex().then(() => { items = runSearch(q).slice(0, 6); active = -1; paint(); });
  }, 110);

  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (items.length) paint(); });

  input.addEventListener('keydown', (e) => {
    if (box.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, -1); paint(); }
    else if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      go(`#/fatwa/${state.index.id[items[active].i]}`);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) go(searchHref({ q }));
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) close();
  }, { once: false });

  loadIndex();
  setTimeout(() => { if (window.innerWidth > 720) input.focus(); }, 90);
}

/* ------------------------------------------------------------------ */
/*  View: search results                                               */
/* ------------------------------------------------------------------ */
const PAGE = 20;

function viewSearch(params) {
  const m = state.meta;
  main.innerHTML = `
  <div class="wrap py-9">
    <div id="searchHead"></div>
    <div class="mt-7 grid gap-9 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside class="hidden lg:block">
        <div class="sticky top-24 space-y-7">
          <div>
            <p class="eyebrow mb-3">Topic</p>
            <div id="catFilter" class="flex max-h-[46vh] flex-col gap-0.5 overflow-y-auto pr-1"></div>
          </div>
          <div>
            <p class="eyebrow mb-3">Volume</p>
            <div id="volFilter" class="flex flex-wrap gap-1.5"></div>
          </div>
        </div>
      </aside>
      <div class="min-w-0">
        <div id="mobileFilter" class="mb-5 lg:hidden"></div>
        <div id="resultArea">${skeletonList()}</div>
      </div>
    </div>
  </div>`;

  const paintFilters = () => {
    const active = params.category;
    $('#catFilter').innerHTML = [{ slug: '', name: 'All topics', count: m.total }]
      .concat(m.categories).map(c => `
        <a href="${searchHref({ ...params, category: c.slug, from: 0, to: 0 })}"
           class="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150"
           style="${c.slug === active
             ? 'background: var(--color-accent-soft); color: var(--color-accent); font-weight:500'
             : 'color: var(--color-muted)'}">
          <span class="truncate">${esc(c.name)}</span>
          <span class="ml-2 shrink-0 text-[11px] tabular-nums opacity-60">${c.count}</span>
        </a>`).join('');

    $('#volFilter').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => `
      <a href="${searchHref({ ...params, volume: v, from: 0, to: 0 })}"
         class="grid h-9 min-w-9 place-items-center rounded-md border px-2 text-[12.5px] transition-colors duration-150"
         style="${v === params.volume
           ? 'background: var(--color-accent); border-color: var(--color-accent); color:#fff'
           : 'border-color: var(--color-line); color: var(--color-muted)'}">
        ${v === 0 ? 'All' : v}</a>`).join('');

    const activeBits = [];
    if (params.category) activeBits.push(catName(params.category));
    if (params.volume) activeBits.push(`Volume ${params.volume}`);
    $('#mobileFilter').innerHTML = `
      <button id="filterOpen" class="btn w-full !justify-between !py-3">
        <span class="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.8" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" stroke-linecap="round"/>
          </svg>
          Filters
        </span>
        <span class="text-[12.5px]" style="color: var(--color-faint)">
          ${activeBits.length ? esc(activeBits.join(' · ')) : 'All topics'}
        </span>
      </button>`;
    $('#filterOpen').addEventListener('click', () => openFilterSheet(params));
  };

  loadIndex().then(() => {
    paintFilters();
    let shown = PAGE;
    const terms = tokenize(params.q);
    const results = runSearch(params.q, {
      category: params.category, volume: params.volume,
      from: params.from, to: params.to,
    });

    const head = () => {
      const bits = [];
      if (params.category) bits.push(catName(params.category));
      if (params.volume) bits.push(`Volume ${params.volume}`);
      if (params.label) bits.push(params.label);
      $('#searchHead').innerHTML = `
        <form id="resultForm" class="search-shell max-w-2xl" role="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
               class="shrink-0" style="color: var(--color-faint)" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/>
          </svg>
          <input id="resultInput" type="search" value="${esc(params.q)}"
                 placeholder="Search fatawa…" aria-label="Search fatawa" autocomplete="off">
          ${params.q ? `<button type="button" id="clearBtn" class="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors sm:h-7 sm:w-7"
             style="color: var(--color-faint)" aria-label="Clear search">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/></svg></button>` : ''}
        </form>
        <p class="mt-4 text-[13.5px]" style="color: var(--color-muted)">
          <span class="tabular-nums" style="color: var(--color-ink)">${nfmt(results.length)}</span>
          ${results.length === 1 ? 'fatwa' : 'fatawa'}${params.q ? ` for “${esc(params.q)}”` : ''}
          ${bits.length ? ` · ${bits.map(esc).join(' · ')}` : ''}
          ${(params.q || params.category || params.volume || params.from)
            ? ` · <a href="#/search" class="underline underline-offset-2" style="color: var(--color-accent)">reset</a>` : ''}
        </p>`;
      wireResultInput();
    };

    const paint = () => {
      const area = $('#resultArea');
      if (!results.length) {
        area.innerHTML = emptyState('No fatawa found',
          'Try different words, or clear the filters to search the whole collection.');
        return;
      }
      area.innerHTML = `
        <div class="stagger space-y-3">
          ${results.slice(0, shown).map(r => resultCard(r.i, terms)).join('')}
        </div>
        ${shown < results.length ? `<div class="mt-8 flex justify-center">
          <button id="moreBtn" class="btn">Show more
            <span class="opacity-55">${nfmt(results.length - shown)} left</span></button>
        </div>` : ''}`;
      const more = $('#moreBtn');
      if (more) more.addEventListener('click', () => { shown += PAGE * 2; paint(); });
    };

    head();
    paint();
  }).catch(() => {
    $('#resultArea').innerHTML = emptyState('Could not load the collection', 'Please refresh the page.');
  });

  function wireResultInput() {
    const input = $('#resultInput');
    const clear = $('#clearBtn');
    if (clear) clear.addEventListener('click', () => go(searchHref({ ...params, q: '' }), false));
    $('#resultForm').addEventListener('submit', e => {
      e.preventDefault();
      go(searchHref({ ...params, q: input.value.trim() }));
    });
    const live = debounce(() => {
      const v = input.value.trim();
      if (v === params.q) return;
      history.replaceState(null, '', searchHref({ ...params, q: v }));
      state.route = parseHash();
      viewSearch(state.route.params);
      requestAnimationFrame(() => {
        const el = $('#resultInput');
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }, 260);
    input.addEventListener('input', live);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

/* ------------------------------------------------------------------ */
/*  Mobile filter sheet                                                */
/* ------------------------------------------------------------------ */
function openFilterSheet(params) {
  const m = state.meta;
  document.querySelectorAll('.sheet, .sheet-scrim').forEach(n => n.remove());

  const scrim = document.createElement('div');
  scrim.className = 'sheet-scrim fixed inset-0 z-40 bg-black/25 opacity-0 transition-opacity duration-300';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Filter fatawa');
  sheet.innerHTML = `
    <div class="mx-auto mb-4 h-1 w-10 rounded-full" style="background: var(--color-line)"></div>
    <div class="mb-3 flex items-center justify-between">
      <p class="display text-[18px]">Filters</p>
      <a href="${searchHref({ q: params.q })}" class="text-[13px] underline underline-offset-2"
         style="color: var(--color-accent)">Reset</a>
    </div>

    <p class="eyebrow mb-2 mt-5">Volume</p>
    <div class="flex flex-wrap gap-2">
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => `
        <a href="${searchHref({ ...params, volume: v, from: 0, to: 0 })}"
           class="grid h-11 min-w-11 place-items-center rounded-lg border px-3 text-[14px]"
           style="${v === params.volume
             ? 'background: var(--color-accent); border-color: var(--color-accent); color:#fff'
             : 'border-color: var(--color-line); color: var(--color-ink-soft)'}">
          ${v === 0 ? 'All' : v}</a>`).join('')}
    </div>

    <p class="eyebrow mb-2 mt-6">Topic</p>
    <div class="flex flex-col gap-0.5">
      ${[{ slug: '', name: 'All topics', count: m.total }].concat(m.categories).map(c => `
        <a href="${searchHref({ ...params, category: c.slug, from: 0, to: 0 })}"
           class="filter-row" aria-pressed="${c.slug === params.category}">
          <span class="truncate">${esc(c.name)}</span>
          <span class="ml-3 shrink-0 text-[12px] tabular-nums opacity-60">${c.count}</span>
        </a>`).join('')}
    </div>`;

  document.body.append(scrim, sheet);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    scrim.classList.replace('opacity-0', 'opacity-100');
    sheet.classList.add('open');
  });

  const close = () => {
    sheet.classList.remove('open');
    scrim.classList.replace('opacity-100', 'opacity-0');
    document.body.style.overflow = '';
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 320);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  sheet.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
}

/* ------------------------------------------------------------------ */
/*  View: single fatwa                                                 */
/* ------------------------------------------------------------------ */
function viewFatwa(id) {
  main.innerHTML = `<div class="wrap-narrow py-10">
    <div class="skel h-3 w-40"></div>
    <div class="skel mt-5 h-8 w-4/5"></div>
    <div class="skel mt-8 h-24 w-full"></div>
    <div class="skel mt-6 h-64 w-full"></div>
  </div>`;

  Promise.all([loadFatwa(id), loadIndex().catch(() => null)]).then(([f]) => {
    const ix = state.index;
    const pos = ix ? ix.id.indexOf(id) : -1;
    const prev = pos > 0 ? ix.id[pos - 1] : null;
    const next = pos >= 0 && pos < ix.n - 1 ? ix.id[pos + 1] : null;

    main.innerHTML = `
    <article class="wrap-narrow py-10">
      <nav class="anim-fade mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"
           style="color: var(--color-muted)" aria-label="Breadcrumb">
        <a href="#/" class="tap transition-colors hover:opacity-70">Home</a><span>/</span>
        <a href="${searchHref({ volume: f.volume })}" class="tap transition-colors hover:opacity-70">Volume ${f.volume}</a><span>/</span>
        <a href="${searchHref({ category: f.categorySlug })}" class="tap transition-colors hover:opacity-70">${esc(f.category)}</a>
      </nav>

      <header class="anim-rise">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="tag">${esc(f.category)}</span>
          <span class="text-[12px]" style="color: var(--color-faint)">Fatwa No. ${f.id}</span>
          ${f.translated ? '' : `<span class="text-[12px]" style="color: var(--color-faint)">· English translation pending</span>`}
        </div>
        <h1 class="display text-[30px] leading-[1.2] sm:text-[38px]">${esc(f.title)}</h1>
        ${f.chapter || f.section ? `<div class="mt-3 flex flex-col gap-1 text-[13px]" style="color: var(--color-muted)">
            ${f.chapter ? `<span class="ar-inline" dir="rtl">${esc(f.chapter)}</span>` : ''}
            ${f.section ? `<span class="ar-inline" dir="rtl">${esc(f.section)}</span>` : ''}
          </div>` : ''}
      </header>

      <div class="mt-7 flex flex-wrap gap-2 anim-rise" style="animation-delay:.06s">
        <button id="urduBtn" class="btn" aria-pressed="false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M4 5h16M4 12h16M4 19h10" stroke-linecap="round"/></svg>
          Original Urdu
        </button>
        <button id="copyBtn" class="btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          Copy link
        </button>
        <a class="btn" href="https://fduz.org/fatwa/${f.id}" target="_blank" rel="noopener noreferrer">Source ↗</a>
      </div>

      <div id="englishPane" class="anim-rise mt-9" style="animation-delay:.1s">
        ${f.question?.trim() ? `
          <section class="rounded-[var(--radius-card)] border p-6"
                   style="background: var(--color-sunk); border-color: var(--color-line-soft)">
            <p class="eyebrow mb-3">Question</p>
            <div class="${f.translated ? 'prose-fatwa !text-[16.5px]' : 'ur-text'}"
                 ${f.translated ? '' : 'dir="rtl"'}>
              ${f.translated ? renderProse(f.question) : renderUrdu(f.question)}
            </div>
          </section>` : ''}

        <section class="mt-8">
          <p class="eyebrow mb-3">Answer</p>
          <div class="${f.translated ? 'prose-fatwa' : 'ur-text'}" ${f.translated ? '' : 'dir="rtl"'}>
            ${f.translated ? renderProse(f.answer) : renderUrdu(f.answer)}
          </div>
        </section>
      </div>

      <div id="urduPane" class="mt-9 hidden">
        <section class="rounded-[var(--radius-card)] border p-6"
                 style="background: var(--color-sunk); border-color: var(--color-line-soft)">
          <p class="eyebrow mb-3">اصل عبارت — Original Urdu</p>
          <h2 class="ur-text mb-5 !text-[22px]" dir="rtl">${esc(f.urdu.title)}</h2>
          <div class="ur-text" dir="rtl">${renderUrdu(f.urdu.question)}</div>
        </section>
        <section class="mt-6 ur-text" dir="rtl">${renderUrdu(f.urdu.answer)}</section>
      </div>

      <nav class="mt-14 grid gap-3 sm:grid-cols-2" aria-label="Adjacent fatawa">
        ${prev ? navCard(prev, 'Previous') : '<div></div>'}
        ${next ? navCard(next, 'Next', true) : '<div></div>'}
      </nav>
    </article>`;

    const urduBtn = $('#urduBtn');
    urduBtn.addEventListener('click', () => {
      const showing = $('#urduPane').classList.toggle('hidden');
      $('#englishPane').classList.toggle('hidden', !showing);
      urduBtn.setAttribute('aria-pressed', String(!showing));
      if (!showing) $('#urduPane').classList.add('anim-fade');
    });

    $('#copyBtn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(location.href);
        const old = btn.innerHTML;
        btn.innerHTML = 'Copied';
        setTimeout(() => { btn.innerHTML = old; }, 1400);
      } catch { /* clipboard unavailable */ }
    });

    window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
  }).catch(() => {
    main.innerHTML = `<div class="wrap-narrow">${emptyState('Fatwa not found',
      'This ruling does not exist in the collection.')}</div>`;
  });

  function navCard(nid, label, right = false) {
    const ix = state.index;
    const k = ix ? ix.id.indexOf(nid) : -1;
    const t = k >= 0 ? ix.t[k] : `Fatwa ${nid}`;
    return `<a class="card !p-4 ${right ? 'sm:text-right' : ''}" href="#/fatwa/${nid}">
      <p class="eyebrow mb-1.5">${label}</p>
      <p class="display text-[15px] leading-snug">${esc(t)}</p>
    </a>`;
  }
}

/* ------------------------------------------------------------------ */
/*  View: browse                                                       */
/* ------------------------------------------------------------------ */
function viewBrowse(volume) {
  const m = state.meta;
  const vols = m.volumes;

  if (!volume) {
    main.innerHTML = `
    <div class="wrap py-12">
      <header class="anim-rise max-w-xl">
        <p class="eyebrow">The collection</p>
        <h1 class="display mt-3 text-[34px] leading-tight sm:text-[42px]">Browse by volume</h1>
        <p class="mt-3 text-[15px] leading-relaxed" style="color: var(--color-muted)">
          ${nfmt(m.total)} rulings arranged across nine volumes, following the classical
          order of the fiqh manuals.
        </p>
      </header>

      <div class="mt-10">
        <p class="eyebrow mb-4">All topics</p>
        <div class="flex flex-wrap gap-2">
          ${m.categories.map(c => `<a class="chip" href="${searchHref({ category: c.slug })}">
            ${esc(c.name)} <span class="chip-count">${c.count}</span></a>`).join('')}
        </div>
      </div>

      <div class="mt-12 rule"></div>

      <div class="stagger mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        ${vols.map(v => `
          <a class="card" href="#/browse/${v.volume}">
            <p class="eyebrow">Volume ${v.volume}</p>
            <p class="display mt-2 text-[21px]">${nfmt(v.total)} fatawa</p>
            <p class="mt-2 text-[13px] leading-relaxed" style="color: var(--color-muted)">
              ${v.chapters.slice(0, 3).map(c => esc(c.title)).join(' · ')}${v.chapters.length > 3 ? ' …' : ''}
            </p>
          </a>`).join('')}
      </div>
    </div>`;
    return;
  }

  const v = vols.find(x => x.volume === volume);
  if (!v) { main.innerHTML = `<div class="wrap">${emptyState('Volume not found', '')}</div>`; return; }

  main.innerHTML = `
  <div class="wrap-narrow py-12">
    <nav class="anim-fade mb-6 text-[12.5px]" style="color: var(--color-muted)">
      <a href="#/browse" class="tap transition-colors hover:opacity-70">Browse</a>
      <span class="mx-2">/</span>Volume ${v.volume}
    </nav>
    <header class="anim-rise">
      <p class="eyebrow">Volume ${v.volume}</p>
      <h1 class="display mt-3 text-[32px] leading-tight sm:text-[40px]">${nfmt(v.total)} fatawa</h1>
    </header>
    <div class="stagger mt-9 space-y-2.5">
      ${v.chapters.map(c => `
        <a class="card !p-4 flex items-center justify-between gap-4"
           href="${searchHref({ volume: v.volume, from: c.firstId, to: c.lastId, label: c.title })}">
          <span class="min-w-0">
            <span class="display block text-[17px] leading-snug">${esc(c.title)}</span>
            ${c.arabic ? `<span class="ar-inline mt-1 block text-[14px]" dir="rtl"
                 style="color: var(--color-muted)">${esc(c.arabic)}</span>` : ''}
            <span class="mt-1 block text-[12.5px]" style="color: var(--color-faint)">
              Fatawa ${c.firstId}–${c.lastId}
            </span>
          </span>
          <span class="shrink-0 text-[13px] tabular-nums" style="color: var(--color-muted)">${c.count}</span>
        </a>`).join('')}
    </div>
    <div class="mt-10 flex justify-center">
      <a class="btn" href="${searchHref({ volume: v.volume })}">Search all of volume ${v.volume}</a>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  View: about                                                        */
/* ------------------------------------------------------------------ */
function viewAbout() {
  const m = state.meta;
  main.innerHTML = `
  <div class="wrap-narrow py-14">
    <header class="anim-rise">
      <p class="eyebrow">About</p>
      <h1 class="display mt-3 text-[34px] leading-tight sm:text-[42px]">
        About this edition
      </h1>
    </header>

    <div class="anim-rise mt-8 space-y-5 text-[16px] leading-[1.75]"
         style="color: var(--color-ink-soft); animation-delay:.06s">
      <p>
        <em>Fatawa Darul Uloom Zakariyya</em> is the collected fatawa of the Dar al-Iftā of
        Darul Uloom Zakariyya, issued in nine volumes and written in Urdu. This site presents
        an English edition of the complete collection — ${nfmt(m.total)} rulings — alongside
        the original text of every fatwa.
      </p>

      <h2 class="display pt-3 text-[21px]" style="color: var(--color-ink)">How the translation was made</h2>
      <p>
        Each fatwa was translated individually rather than in bulk, so that the reasoning of a
        ruling is carried across as a whole. The aim throughout is plain, natural English: the
        rulings should be readable by someone without specialist training, while keeping the
        legal distinctions of the original intact — <em>farḍ</em> (obligatory),
        <em>wājib</em> (necessary), <em>sunnah</em>, <em>mustaḥabb</em> (recommended) and
        <em>makrūh</em> (disliked) are never flattened into one another.
      </p>

      <h2 class="display pt-3 text-[21px]" style="color: var(--color-ink)">Arabic is never translated</h2>
      <p>
        The fatawa quote the Qur'an, hadith, and the classical Hanafi manuals. Every one of
        those Arabic passages is reproduced exactly as it appears in the source — including the
        reference that follows it — and is set apart on the page so it can be read on its own
        terms. Only the Urdu around them has been translated.
      </p>

      <h2 class="display pt-3 text-[21px]" style="color: var(--color-ink)">A note on use</h2>
      <p>
        A translation is not a substitute for the original, and a fatwa answers the question of
        the person who asked it, in their circumstances. For a ruling on your own situation,
        consult a qualified muftī. Where the English and the Urdu appear to differ, the Urdu
        original governs; it is provided on every page.
      </p>

      <div class="rule my-4"></div>
      <p class="text-[14px]" style="color: var(--color-muted)">
        Source text: <a href="https://fduz.org" target="_blank" rel="noopener noreferrer"
        class="underline underline-offset-2" style="color: var(--color-accent)">fduz.org</a>,
        the official digital edition published by Darul Uloom Zakariyya.
      </p>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */
function syncHeader(route) {
  const hs = $('#headerSearch');
  // The search and home views carry their own search field.
  const hide = route.name === 'home' || route.name === 'search';
  hs.classList.toggle('hidden', hide);
  hs.classList.toggle('flex', !hide);
  document.querySelectorAll('[data-nav]').forEach(a => {
    const on = a.dataset.nav === route.name;
    a.style.color = on ? 'var(--color-ink)' : 'var(--color-muted)';
  });
  const input = $('#headerSearchInput');
  if (input) input.value = route.name === 'search' ? (route.params.q || '') : '';
}

function render() {
  const route = parseHash();
  state.route = route;

  loadMeta().then(() => {
    syncHeader(route);
    switch (route.name) {
      case 'fatwa':  viewFatwa(route.params.id); break;
      case 'search': viewSearch(route.params); break;
      case 'browse': viewBrowse(route.params.volume); break;
      case 'about':  viewAbout(); break;
      default:       viewHome();
    }
    if (route.name !== 'fatwa') window.scrollTo(0, 0);
  }).catch(() => {
    main.innerHTML = `<div class="wrap">${emptyState('Could not load the collection',
      'The data files are missing. Run the build script, then refresh.')}</div>`;
  });
}

function boot() {
  // theme
  const applyIcons = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    $('.theme-icon-light').classList.toggle('hidden', dark);
    $('.theme-icon-dark').classList.toggle('hidden', !dark);
  };
  applyIcons();
  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('fduz-en-theme', next); } catch {}
    applyIcons();
  });

  // mobile navigation drawer
  const drawer = $('#navDrawer');
  const scrim = $('#navScrim');
  const menuBtn = $('#menuToggle');
  const openNav = () => {
    drawer.classList.remove('hidden');
    scrim.classList.remove('hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawer.classList.remove('-translate-y-full'));
  };
  const closeNav = () => {
    drawer.classList.add('-translate-y-full');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { drawer.classList.add('hidden'); scrim.classList.add('hidden'); }, 300);
  };
  menuBtn.addEventListener('click', openNav);
  $('#menuClose').addEventListener('click', closeNav);
  scrim.addEventListener('click', closeNav);
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeNav();
  });

  // header search
  $('#headerSearchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#headerSearchInput').value.trim();
    go(searchHref({ q }));
  });

  // header elevation + reading progress
  const header = $('#siteHeader');
  const bar = $('#scrollProgress');
  const onScroll = () => {
    const y = window.scrollY;
    header.style.borderColor = y > 6 ? 'var(--color-line)' : 'transparent';
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 200 ? `${Math.min(100, (y / h) * 100)}%` : '0%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // "/" focuses search from anywhere
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      const t = $('#homeInput') || $('#resultInput') || $('#headerSearchInput');
      if (t) t.focus();
    }
  });

  window.addEventListener('hashchange', render);
  render();
}

document.addEventListener('DOMContentLoaded', boot);
})();
