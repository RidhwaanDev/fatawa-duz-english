# Fatawa Darul Uloom Zakariyya — English Edition

**Live: https://fatawa-english.netlify.app**

A minimal, search-first English edition of the nine-volume Urdu fatwa collection
published by Darul Uloom Zakariyya ([fduz.org](https://fduz.org)).

The site is plain HTML, CSS (Tailwind) and vanilla JavaScript — no framework, no
runtime dependencies. Everything is static and can be served from any file host.

---

## What this is

- **3,742 fatawa** across 9 volumes, each translated individually from Urdu into
  plain, idiomatic English.
- **Arabic is never translated.** Qur'anic verses, hadith, quotations from the
  classical Hanafi manuals and their source references are reproduced verbatim and
  styled as right-to-left pull-quotes.
- **The Urdu original is on every page**, one tap away, so the translation can always
  be checked against the source.
- **33 topic categories** (Prayer, Zakat, Hajj, Marriage, Divorce, Trade…) derived from
  the collection's own *kitāb* and *bāb* headings.

---

## Running it

```bash
npm install
npm run build     # regenerate site data + compile CSS
npm run serve     # http://localhost:4173
```

| Script | Purpose |
|---|---|
| `npm run data`  | Rebuild `public/data/` from `data/raw/` + `data/en/` |
| `npm run css`   | Compile `src/input.css` → `public/styles.css` |
| `npm run watch` | Recompile CSS on change |
| `npm run build` | `data` + `css` |
| `npm run serve` | Static server on port 4173 |

---

## Layout

```
data/
  raw/     3,742 source records scraped from the API (Urdu)      00001.json …
  en/      English translations, one file per fatwa              00001.md …
  toc/     Volume tables of contents + collection stats
public/
  index.html  app.js  styles.css  favicon.svg
  data/       meta.json, index.json, fatwa/<id>.json   ← generated, do not edit
scripts/
  scrape.py             polite, resumable scraper for fduz.org
  categories.py         chapter/section → English category taxonomy
  build_site.py         generates everything under public/data/
  batches.py            splits the corpus into translation batches
  validate.py           translation quality gate
  audit.js              responsive UI audit (mobile/tablet/desktop)
  smoke.js              headless render test of every view
  TRANSLATION_GUIDE.md  the translation style specification
  AGENT_TASK.md         standing instructions for translation agents
```

`data/raw/` and `data/en/` are the source of truth. `public/data/` is generated.

---

## The translation pipeline

Translation is done one fatwa at a time by Claude Opus 5 agents, each assigned a
contiguous batch of neighbouring rulings so that terminology stays consistent within
a chapter.

```bash
python3 scripts/batches.py            # regenerate batch manifest (182 batches)
python3 scripts/batches.py --status   # progress
python3 scripts/batches.py --todo     # batches still containing untranslated ids
```

Each agent reads `scripts/AGENT_TASK.md`, follows `scripts/TRANSLATION_GUIDE.md`, and
writes one file per fatwa:

```
### TITLE
Using a title of reverence with Allah's name

### QUESTION
When Allah's name comes up, is it required or is it recommended to say …

### ANSWER
From the statements of the jurists it appears that …
```

### Quality gate

```bash
python3 scripts/validate.py           # whole corpus
python3 scripts/validate.py 1 25      # an id range
python3 scripts/validate.py --list    # ids needing rework
```

`validate.py` catches the two failure modes that matter:

1. **Untranslated Urdu left in the output.** Urdu and Arabic share a Unicode block, so
   detection keys on letters Urdu uses and Arabic does not (`ی ے ہ ھ ں پ چ ژ ڈ ڑ ٹ گ ک`),
   measured per right-to-left run rather than per line — a short quoted formula is fine,
   a paragraph of Urdu prose is not. It deliberately does *not* whitelist text found in
   the source, so pasting the original back in still fails.
2. **Arabic citations dropped, altered, or translated.** Every pure-Arabic line of 40+
   characters in the source must appear unchanged in the output.

It is negative-tested against four sabotage cases: pasted raw Urdu, a dropped citation,
a citation translated into English, and malformed headers.

---

## Checks

```bash
node scripts/smoke.js    # every view renders, no console errors
node scripts/audit.js    # layout audit at 390 / 768 / 1440 px
```

`audit.js` fails on horizontal overflow, clipped text, tap targets under 44 px on
mobile, and text below 11 px. Screenshots land in `.shots/`.

---

## Notes on the source data

The upstream site exposes a JSON API which `scrape.py` reads politely (2 workers,
0.6 s delay, exponential backoff on 429/5xx, resumable — it skips anything already on
disk). Endpoints used:

- `/api/stats` — volume list and counts
- `/api/volume/<n>/contents` — chapter/section tree with id ranges
- `/api/fatwa/<id>` — the full record (listing endpoints truncate the answer)

Ids are global and sequential, 1–3742.

---

## Fatawa Mahmudiyyah (second collection)

A second collection is served from the same app under the `#/mahmudiyyah` route
prefix. It shares every view, style and search behaviour with the Zakariyya
edition — only the data directory differs (`public/data/mahmudiyyah/`).

```bash
npm run data:mahmudiyyah    # build just this collection
npx playwright test tests/mahmudiyyah.spec.js
```

Entries live in `data/mahmudiyyah/source.json` and are keyed by `id`:

| field | meaning |
| --- | --- |
| `volume`, `page` | printed volume and page number |
| `pdfPage` | 1-based page in the archive.org PDF (used to build the scan link) |
| `chapter` | Arabic kitāb heading; drives the topic taxonomy |
| `title`, `question`, `answer` | the English entry |
| `references` | works the ruling cites |
| `signedBy` | the signature line |
| `mode` | `summary` (default) or `full` |

### Current status: summaries, not translations

The entries presently shipped are **summaries** — what the questioner asked and
what the muftī ruled, plus the works cited — each deep-linked to the exact
scanned page. They are not renderings of the book's own prose.

Two reasons, and the second is the binding one:

1. The work is in copyright (Maktaba Mahmoodia). Summarising a ruling conveys
   its substance; reproducing the book in English is a different act.
2. **There is no usable text layer.** archive.org's OCR for this Nastaʿlīq is
   noise, and the PDFs carry a legacy non-Unicode font dump rather than
   recoverable Urdu (`pdftotext` yields `]Ìz] Z f Å\¬vZ`). Pages must therefore
   be read as images. That is dependable for substance but *not* dependable at
   word level — and in fiqh the qualifiers carry the ruling, so a dropped
   condition or a flipped negation silently inverts the verdict. Machine-read
   word-for-word text is not safe to publish as a muftī's ruling.

For scale: vol. 3 alone is 457 pages; the set runs past 14,000.

### Adding full translations

The pipeline already supports them. Add to an entry:

```jsonc
{
  "mode": "full",
  "question": "…English…",
  "answer":   "…English…",
  "urduQuestion": "…original Urdu…",
  "urduAnswer":   "…original Urdu…"
}
```

`mode` is inferred as `full` whenever Urdu text is present. Such entries render
in the same layout as the Zakariyya records, Urdu toggle included, and the
summary notice disappears — no code changes required. Text should come from a
human translator working against the scans, ideally scholar-checked.



A translation is not a substitute for the original, and a fatwa answers the question of
the person who asked it, in their circumstances. For a ruling on your own situation,
consult a qualified muftī. Where the English and the Urdu differ, the Urdu governs.
