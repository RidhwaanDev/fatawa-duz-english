#!/usr/bin/env python3
"""Builds the static data the web app consumes.

Outputs into public/data/:
  meta.json          categories, volumes, chapter tree, counts
  index.json         compact parallel-array search index (all fatawa)
  fatwa/<id>.json    full record: English + original Urdu
"""
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import classify, ORDER
from validate import parse_en

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
EN = os.path.join(ROOT, "data", "en")
TOC = os.path.join(ROOT, "data", "toc")
OUT = os.path.join(ROOT, "public", "data")

AR = r"\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF"
RTL = re.compile(f"[{AR}]")
# Modifier letters used in transliteration (ʿayn / hamza) carry no combining mark.
MODIFIERS = str.maketrans({"\u02bf": None, "\u02be": None, "\u2018": None,
                           "\u2019": "'", "\u02bc": "'"})


def fold(text):
    """Strip diacritics so 'ṣalāh' and 'salah' match, and 'wuḍūʾ' matches 'wudu'."""
    text = text.translate(MODIFIERS)
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def snippet(text, limit=210):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > 60 else cut).rstrip(" ,.;:") + "…"


def searchable(*parts):
    """Latin-only, diacritic-folded lowercase text used for client-side matching."""
    text = " ".join(p or "" for p in parts)
    text = RTL.sub(" ", text)
    text = fold(text)
    text = re.sub(r"[^a-z0-9' ]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def main():
    os.makedirs(os.path.join(OUT, "fatwa"), exist_ok=True)

    ids = sorted(int(n[:5]) for n in os.listdir(RAW) if n.endswith(".json"))
    idx = {"id": [], "t": [], "c": [], "v": [], "s": [], "k": [], "e": []}
    cat_counts = {}
    cat_names = {}
    translated = 0

    for fid in ids:
        with open(os.path.join(RAW, f"{fid:05d}.json"), encoding="utf-8") as f:
            src = json.load(f)

        name, slug = classify(src.get("chapter"), src.get("section"))
        cat_names[slug] = name

        en_path = os.path.join(EN, f"{fid:05d}.md")
        en = None
        if os.path.exists(en_path):
            en, err = parse_en(en_path)
            if err:
                en = None
        if en:
            translated += 1

        title = (en["title"] if en else (src.get("title") or "").strip().rstrip(":"))
        body_q = en["question"] if en else (src.get("question") or "")
        body_a = en["answer"] if en else (src.get("answer") or "")

        record = {
            "id": fid,
            "title": title,
            "question": body_q,
            "answer": body_a,
            "translated": bool(en),
            "category": name,
            "categorySlug": slug,
            "volume": src.get("volume"),
            "chapter": src.get("chapter") or "",
            "section": src.get("section") or "",
            "urdu": {
                "title": (src.get("title") or "").strip(),
                "question": src.get("question") or "",
                "answer": src.get("answer") or "",
            },
        }
        with open(os.path.join(OUT, "fatwa", f"{fid}.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, separators=(",", ":"))

        idx["id"].append(fid)
        idx["t"].append(title)
        idx["c"].append(slug)
        idx["v"].append(src.get("volume"))
        idx["s"].append(snippet(body_q or body_a))
        idx["k"].append(searchable(title, body_q[:1400], body_a[:1400]))
        idx["e"].append(1 if en else 0)
        cat_counts[slug] = cat_counts.get(slug, 0) + 1

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))

    # ---- volumes / chapter tree ----
    volumes = []
    for name in sorted(os.listdir(TOC)):
        if not name.startswith("volume-"):
            continue
        with open(os.path.join(TOC, name), encoding="utf-8") as f:
            c = json.load(f)["contents"]
        chapters = []
        for ch in c["chapters"]:
            cname, cslug = classify(ch["title"], (ch["sections"] or [{}])[0].get("title"))
            chapters.append({
                "title": cname,
                "arabic": ch["title"] if ch["title"] != "Uncategorized" else "",
                "category": cslug,
                "count": ch["count"],
                "firstId": ch["firstId"],
                "lastId": ch["lastId"],
            })
        volumes.append({"volume": c["volume"], "total": c["total"], "chapters": chapters})

    categories = [{"slug": s, "name": cat_names[s], "count": cat_counts[s]}
                  for s in ORDER if s in cat_counts]
    for s in sorted(cat_counts):
        if s not in ORDER:
            categories.append({"slug": s, "name": cat_names[s], "count": cat_counts[s]})

    meta = {
        "total": len(ids),
        "translated": translated,
        "categories": categories,
        "volumes": volumes,
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(os.path.join(OUT, "index.json")) / 1024
    print(f"built {len(ids)} fatawa ({translated} translated), "
          f"{len(categories)} categories, index {size:.0f} KB")


if __name__ == "__main__":
    main()
