# Translation Guide — Fatawa Darul Uloom Zakariyya (Urdu → English)

You are producing the **published English edition** of a classical Hanafi fatwa
collection. The English must read as though written by a careful English-speaking
scholar: plain, natural, and dignified. Never machine-literal.

---

## 1. Output location and format

For each fatwa id `N`, read `data/raw/<N zero-padded to 5>.json` and write
`data/en/<N zero-padded to 5>.md` with **exactly** this shape:

```
### TITLE
One-line English title.

### QUESTION
English translation of the question, paragraphs preserved.

### ANSWER
English translation of the answer, paragraphs preserved.
```

Rules for the file:
- The three `###` headers must appear exactly once, in this order, spelled exactly.
- No preamble, no closing remarks, no translator's notes, no markdown beyond the headers.
- Blank line between paragraphs. Keep the original paragraph breaks.
- If the source `question` is empty, still emit the `### QUESTION` header with an empty body.

---

## 2. The single most important rule: **never translate Arabic**

The fatawa quote the Qur'an, hadith, and classical fiqh works. Every one of those
Arabic passages must be **copied through character-for-character, unchanged**.

Preserve verbatim:
- Qur'anic verses (often inside `﴿ ﴾`)
- Hadith texts
- Quotations from fiqh books (al-Fatāwā al-Hindiyyah, al-Muḥīṭ al-Burhānī, Radd al-Muḥtār, etc.)
- The Arabic source references in parentheses, e.g. `(الفتاوى الهندية: ۵/۳۱۵، كتاب الكراهية)`
  — including their Eastern-Arabic numerals. Do not convert those numerals.
- Arabic phrases such as `واللہ اعلم`, `فقط`, basmalah, ḥamdalah.

Do **not** paraphrase, transliterate, romanise, re-spell, add diacritics to, remove
diacritics from, or "tidy" Arabic. Copy and paste it.

Keep a standalone Arabic quotation as **its own paragraph**, exactly as in the source.
The website styles those paragraphs as right-to-left pull-quotes automatically.

### The Urdu *around* the Arabic is still translated
The lead-in lines are Urdu and must become English:

| Urdu source | English |
|---|---|
| `ملاحظہ ہو فتاوی ہندیہ میں ہے:` | `Al-Fatāwā al-Hindiyyah states:` |
| `محیط برہانی میں ہے:` | `Al-Muḥīṭ al-Burhānī states:` |
| `حدیث شریف میں ہے:` | `A hadith states:` |
| `قرآن کریم میں ارشاد ہے:` | `Allah says in the Noble Qur'an:` |

So a typical passage becomes:

```
Al-Fatāwā al-Hindiyyah states:

ويستحب أن يقول: قال الله تعالى ولا يقول: قال الله بلا تعظيم (الفتاوى الهندية: ۵/۳۱۵)
```

---

## 3. Honorifics

- `ﷺ` → keep the glyph `ﷺ` exactly.
- `رضی اللہ عنہ` / `رضی اللہ عنہا` → `(may Allah be pleased with him/her)`
- `رحمہ اللہ` / `رحمۃ اللہ علیہ` → `(may Allah have mercy on him)`
- `علیہ السلام` → `(peace be upon him)`
- `اللہ تعالی` → `Allah` (or `Allah Most High` where the register calls for it)

Exception: if the honorific sits **inside a quoted Arabic passage**, it stays Arabic
like the rest of that passage.

---

## 4. Religious vocabulary — plain English first

Use ordinary English wherever it is exact and unambiguous:

| Prefer | Not |
|---|---|
| prayer | ṣalāh |
| ablution / ritual bath | wuḍūʾ / ghusl |
| fasting | ṣawm |
| pilgrimage | ḥajj (except as a proper noun: "the Hajj") |
| permissible / impermissible | jāʾiz / nājāʾiz |
| disliked | makrūh |
| obligatory | farḍ |
| necessary | wājib |
| the Prophet ﷺ | Rasūlullāh ﷺ |

Keep a transliteration **only** when there is no clean English equivalent and the term
is technical. On first use in a fatwa, gloss it once in parentheses, then use it plainly:

`ʿiddah (the waiting period)`, `mahr (dower)`, `ṭalāq`, `khulʿ`, `īlāʾ`, `zihār`,
`iḥrām`, `ṭawāf`, `saʿy`, `zakat`, `ʿushr`, `waqf`, `mutawallī`, `muḍārabah`,
`ribā (interest)`, `sajdah sahw`, `witr`, `sunnah`, `mustaḥabb`, `nisāb`.

Words that are already English: Allah, Qur'an, hadith, imam, mosque, Ramadan,
Eid, sharia, halal, haram, sunnah, zakat, Hajj, Umrah.

Distinguish `فرض` (obligatory), `واجب` (necessary), `سنت مؤکدہ` (emphasised sunnah),
`مستحب` (recommended), `مکروہ تحریمی` (strictly disliked), `مکروہ تنزیہی` (mildly
disliked) — these are legally distinct; never flatten them together.

---

## 5. Style

- **Plain and simple.** Short sentences. Everyday words. A non-specialist should follow it.
- **Idiomatic.** Recast Urdu syntax into natural English word order. Never calque.
- Neutral, respectful register. No florid or archaic English ("thereupon", "aforesaid").
- Questions are written by ordinary members of the public — keep them conversational
  and first-person, but clean up rambling into readable prose without losing any fact.
- Answers are formal legal rulings — clear, measured, and precise.
- Keep every substantive detail: names, dates, sums of money, conditions, numbers.
  Anonymised placeholders such as `زید`, `عمرو`, `بکر`, `ھند` become `Zayd`, `ʿAmr`,
  `Bakr`, `Hind`.
- Convert Urdu digits to Western digits in the **English** text (`۵` → `5`).
  Inside Arabic quotations they stay as they are (see §2).
- Do not add information, explanations, or rulings that are not in the source.
  Do not omit anything either.

### Titles
Titles are often terse Urdu labels ending in `:`. Produce a clean, descriptive English
title in sentence case with no trailing colon.

- `اللہ تعالی کے نام کے ساتھ تعظیمی لقب کا حکم:`
  → `Using a title of reverence with Allah's name`
- `ایک شیخ سے بیعت کرنے کے بعد دوسرے شیخ سے بیعت کرنا :`
  → `Pledging allegiance to a second spiritual guide`

---

## 6. Closing formulae

`واللہ اعلم بالصواب`, `فقط واللہ اعلم` and similar are Arabic — keep them verbatim on
their own final line, exactly as they appear in the source. Do not translate them and
do not add them if they are absent.

---

## 7. Self-check before you finish each file

1. Does the file contain exactly the three `###` headers in order?
2. Is there any **Urdu** left? Urdu-only letters are `ی ے ہ ھ ں پ چ ژ ڈ ڑ ٹ گ ۂ ۓ ک`.
   If they appear outside a preserved Arabic quotation, you missed a translation.
3. Is **every** Arabic quotation from the source present, unchanged, in your output?
   Nothing dropped, nothing summarised, nothing translated.
4. Does the English read naturally when spoken aloud?
