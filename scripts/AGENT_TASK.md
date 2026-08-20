# Translator agent — standing instructions

You are producing the published English edition of *Fatawa Darul Uloom Zakariyya*,
a nine-volume Hanafi fatwa collection written in Urdu with embedded Arabic citations.

**Working directory:** `/Users/ridhwaan/fatawa-duz-english-web-app`

You will be given an id range, e.g. "translate 415 to 440".

---

## Step 1 — Read the style guide in full and follow it exactly

`scripts/TRANSLATION_GUIDE.md`

## Step 2 — Translate your range, ONE AT A TIME, in ascending order

For each id `N`:

1. If `data/en/<N padded to 5 digits>.md` already exists and is non-empty, **skip that id**
   entirely and move to the next one.
2. Read the source `data/raw/<N padded to 5 digits>.json` (id 7 → `data/raw/00007.json`).
   Fields: `title`, `question`, `answer` — Urdu, with embedded Arabic citations.
3. Translate the Urdu into plain, idiomatic, natural English that reads as though written
   by a careful English-speaking scholar.
4. **Copy every Arabic passage through verbatim, character for character** — Qur'anic verses,
   hadith, quotations from the classical fiqh works, and the Arabic source references in
   parentheses such as `(الفتاوى الهندية: ۵/۳۱۵، كتاب الكراهية)`. Never translate,
   transliterate, reformat or "tidy" Arabic. **This is the single most important rule of the
   task.** The Urdu lead-in sentences around those quotations *are* translated into English.
5. Write `data/en/<N padded to 5 digits>.md` with exactly this structure:

```
### TITLE
<english title, sentence case, no trailing colon>

### QUESTION
<english translation of the question, paragraphs preserved>

### ANSWER
<english translation of the answer, paragraphs preserved>
```

The three `###` headers must each appear exactly once, spelled exactly as shown, in this
order. Nothing else in the file — no preamble, no translator's notes, no code fences.

> **Write files with the `create` tool.** Never write them with bash heredocs, `echo`,
> `printf`, or `python -c` string literals — Arabic and Urdu get corrupted by shell escaping.

Never summarise or abbreviate. Some fatawa run to 20,000+ characters; translate them in full.

## Step 3 — Validate

```
cd /Users/ridhwaan/fatawa-duz-english-web-app && python3 scripts/validate.py <LO> <HI>
```

This checks automatically that no untranslated Urdu prose remains and that every Arabic
citation in the source is present unchanged in your output. Fix whatever it flags and re-run
until it reports that all passed.

If the validator flags something you are confident is correct, fix your file rather than the
validator — and say so in your final report.

## Constraints

- Only create or modify `data/en/*.md` files for ids in your assigned range.
- Never modify `scripts/validate.py`, the style guide, this file, or anything else.
- Use `/tmp` for any scratch space; leave no stray files in the repository.

Translation quality is the top priority — these are religious legal texts that will be
published. Report the validator's final output when you finish.
