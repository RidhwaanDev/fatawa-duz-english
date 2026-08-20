#!/usr/bin/env python3
"""Quality gate for translated fatawa.

Flags the two failure modes that matter:
  1. Urdu left untranslated in the English output.
  2. Arabic citations dropped, altered, or translated away.

Usage:
  python3 scripts/validate.py            # whole corpus
  python3 scripts/validate.py 1 25       # id range
  python3 scripts/validate.py --list     # print ids needing rework, one per line
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
EN = os.path.join(ROOT, "data", "en")

# Letters used by Urdu/Persian but not by Arabic. Their presence marks a span as
# Urdu rather than a quoted Arabic citation.
# NOTE: 'آ' is excluded - it is ordinary Arabic (آمين).
URDU_ONLY = set("یےہھںپچژڈڑٹگۂۓک")
AR = r"\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF"
RTL_CHAR = re.compile(f"[{AR}]")
RTL_RUN = re.compile(f"[{AR}][{AR}" + r"\s\d.,:;()\[\]/\-«»\"'،؛؟\u06D4\u200f\u200e]*"
                     f"[{AR}]|[{AR}]")
LATIN = re.compile(r"[A-Za-z]{3}")
TRIM = " \t\r\n.,:;()[]/-«»\"'،؛؟\u06d4\u200f\u200e"
HEADERS = ("### TITLE", "### QUESTION", "### ANSWER")


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def arabic_segments(text):
    """Normalised lines of the source that are pure Arabic citations.

    Urdu and Arabic share a Unicode block and Urdu prose is full of words built
    only from Arabic-common letters, so character-run splitting bridges across
    Urdu lead-ins. The collection keeps every quotation on its own line, so
    line-level segmentation is what actually isolates citations.
    """
    out = []
    for line in re.split(r"[\r\n]+", text):
        line = norm(line).strip(TRIM)
        if not line or any(ch in URDU_ONLY for ch in line):
            continue
        if not RTL_CHAR.search(line):
            continue
        if LATIN.search(line):          # a translated line, not a citation
            continue
        out.append(line)
    return out


def urdu_lines(text):
    """Right-to-left runs that contain Urdu-only letters.

    Measured per line so a run cannot bridge across paragraphs, and measured on
    the run itself rather than its line so that a short Urdu phrase quoted
    inside an English sentence is not mistaken for untranslated prose.
    """
    out = []
    for line in re.split(r"[\r\n]+", text):
        for m in RTL_RUN.finditer(line):
            run = norm(m.group())
            if run and any(ch in URDU_ONLY for ch in run):
                out.append(run)
    return out


def parse_en(path):
    """Split a translated .md file into its three sections."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for h in HEADERS:
        if text.count(h) != 1:
            return None, f"header {h!r} appears {text.count(h)}x (expected 1)"
    i_t = text.index(HEADERS[0])
    i_q = text.index(HEADERS[1])
    i_a = text.index(HEADERS[2])
    if not (i_t < i_q < i_a):
        return None, "headers out of order"
    return {
        "title": text[i_t + len(HEADERS[0]):i_q].strip(),
        "question": text[i_q + len(HEADERS[1]):i_a].strip(),
        "answer": text[i_a + len(HEADERS[2]):].strip(),
    }, None


def check(fid):
    """Return (ok, [problems])."""
    raw_p = os.path.join(RAW, f"{fid:05d}.json")
    en_p = os.path.join(EN, f"{fid:05d}.md")
    if not os.path.exists(raw_p):
        return False, ["source missing"]
    if not os.path.exists(en_p):
        return False, ["not translated"]

    with open(raw_p, encoding="utf-8") as f:
        src = json.load(f)
    en, err = parse_en(en_p)
    if err:
        return False, [err]

    problems = []
    src_text = "\n".join([src.get("title") or "", src.get("question") or "",
                          src.get("answer") or ""])
    out_text = "\n".join([en["title"], en["question"], en["answer"]])
    out_norm = norm(out_text)

    if len(en["answer"]) < 15:
        problems.append("answer too short")
    if (src.get("question") or "").strip() and len(en["question"]) < 5:
        problems.append("question missing")

    # --- 1. Arabic citations from the source must survive verbatim ---
    citations = [c for c in arabic_segments(src_text) if len(c) >= 40]
    missing = [c for c in citations if c not in out_norm]
    if missing:
        problems.append(f"{len(missing)}/{len(citations)} Arabic citations missing "
                        f"or altered, e.g. {missing[0][:70]!r}")

    # --- 2. No Urdu prose should remain ---
    # Short Urdu lines are legitimate (quoted formulae, Urdu book titles inside
    # citations). Long ones mean untranslated prose - including a wholesale paste
    # of the source, which is why this does NOT exempt lines found in the original.
    spans = urdu_lines(out_text)
    long_spans = [s for s in spans if len(s) > 110]
    urdu_chars = sum(len(s) for s in spans)
    if long_spans:
        problems.append(f"{len(long_spans)} untranslated Urdu passage(s), "
                        f"e.g. {long_spans[0][:70]!r}")
    elif out_norm and urdu_chars > 0.18 * len(out_norm):
        problems.append(f"Urdu script is {100*urdu_chars/len(out_norm):.0f}% of output")

    # --- 3. Output should be substantially English ---
    latin = sum(ch.isascii() and ch.isalpha() for ch in out_text)
    if latin < 40:
        problems.append("almost no English text")

    return (not problems), problems


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    list_mode = "--list" in sys.argv
    ids = sorted(int(n[:5]) for n in os.listdir(RAW) if n.endswith(".json"))
    if len(args) == 2:
        lo, hi = int(args[0]), int(args[1])
        ids = [i for i in ids if lo <= i <= hi]

    bad = []
    for fid in ids:
        ok, problems = check(fid)
        if not ok:
            bad.append((fid, problems))

    if list_mode:
        for fid, _ in bad:
            print(fid)
        return

    for fid, problems in bad[:40]:
        print(f"  #{fid}: {'; '.join(problems)}")
    if len(bad) > 40:
        print(f"  ... and {len(bad)-40} more")
    print(f"\n{len(ids)-len(bad)}/{len(ids)} passed, {len(bad)} need rework")


if __name__ == "__main__":
    main()
