#!/usr/bin/env python3
"""Builds the Student Fatawa section of the site.

Reads data/students/source.json and emits, into public/data/students/:
  meta.json          categories, groups, counts, collection info
  index.json         compact parallel-array search index
  fatwa/<id>.json    full record

Output shapes mirror scripts/build_site.py and scripts/build_mahmudiyyah.py so
the web app renders all three collections through the same views.

The collection is passphrase-gated in the browser. That gate is a courtesy
lock only: these files are still served publicly, so nothing genuinely
sensitive belongs here.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_site import searchable, snippet

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "students", "source.json")
OUT = os.path.join(ROOT, "public", "data", "students")

# Shared vocabulary with the other collections so all three filter alike.
CATEGORIES = {
    "faith": "Faith & Belief",
    "purification": "Purification",
    "prayer": "Prayer",
    "funerals": "Funerals",
    "zakat": "Zakat",
    "fasting": "Fasting",
    "hajj": "Hajj & Umrah",
    "marriage": "Marriage",
    "divorce": "Divorce",
    "inheritance": "Inheritance",
    "trade": "Trade & Business",
    "hire": "Hire & Employment",
    "partnership": "Partnership & Investment",
    "property": "Property & Liability",
    "gifts": "Gifts",
    "waqf": "Endowments (Waqf)",
    "oaths": "Oaths & Vows",
    "slaughter": "Hunting & Slaughter",
    "animals": "Animals",
    "dress": "Dress & Appearance",
    "manners": "Manners & Etiquette",
    "leisure": "Leisure & Games",
    "lawful": "Lawful & Unlawful",
    "hudud": "Crime & Punishment",
    "politics": "Politics & Judiciary",
    "quran": "Qur'an & Tajwid",
    "hadith": "Hadith",
    "tasawwuf": "Spirituality (Tasawwuf)",
    "medical": "Medical & Contemporary",
    "finance": "Modern Finance",
    "misc": "Miscellaneous",
}
ORDER = list(CATEGORIES.keys())

# Accepts either a slug ("prayer") or a display name ("Prayer") in the source.
BY_NAME = {v.lower(): k for k, v in CATEGORIES.items()}


def classify(value):
    """Map a source category value to (display name, slug)."""
    v = (value or "").strip()
    if not v:
        return CATEGORIES["misc"], "misc"
    slug = v.lower()
    if slug in CATEGORIES:
        return CATEGORIES[slug], slug
    if slug in BY_NAME:
        return CATEGORIES[BY_NAME[slug]], BY_NAME[slug]
    return CATEGORIES["misc"], "misc"


def load():
    if not os.path.exists(SRC):
        raise SystemExit(f"missing {SRC} — create it first (see README)")
    with open(SRC, encoding="utf-8") as f:
        return json.load(f)


def main():
    os.makedirs(os.path.join(OUT, "fatwa"), exist_ok=True)
    data = load()
    info = data.get("collection", {})
    entries = data.get("entries", [])

    # Stable, gap-free ids in source order; an explicit id wins if given.
    for n, e in enumerate(entries, start=1):
        e.setdefault("id", n)

    idx = {"id": [], "t": [], "c": [], "v": [], "s": [], "k": [], "e": []}
    cat_counts, cat_names = {}, {}
    group_counts = {}

    for e in entries:
        name, slug = classify(e.get("category"))
        cat_names[slug] = name
        title = (e.get("title") or "").strip() or "Untitled"
        q = (e.get("question") or "").strip()
        a = (e.get("answer") or "").strip()
        # "volume" here is the study group / year the answer belongs to.
        group = e.get("group") or e.get("volume") or 1
        try:
            group = int(group)
        except (TypeError, ValueError):
            group = 1

        record = {
            "id": e["id"],
            "title": title,
            "question": q,
            "answer": a,
            "translated": True,
            "category": name,
            "categorySlug": slug,
            "volume": group,
            "chapter": e.get("chapter") or "",
            "section": e.get("section") or "",
            "author": (e.get("author") or "").strip(),
            "reviewedBy": (e.get("reviewedBy") or "").strip(),
            "date": (e.get("date") or "").strip(),
            "references": e.get("references") or [],
            "urdu": {"title": "", "question": "", "answer": ""},
        }
        with open(os.path.join(OUT, "fatwa", f"{e['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, separators=(",", ":"))

        idx["id"].append(e["id"])
        idx["t"].append(title)
        idx["c"].append(slug)
        idx["v"].append(group)
        idx["s"].append(snippet(q or a))
        idx["k"].append(searchable(title, q[:1400], a[:1400],
                                   record["author"], " ".join(record["references"])))
        idx["e"].append(1)
        cat_counts[slug] = cat_counts.get(slug, 0) + 1
        group_counts[group] = group_counts.get(group, 0) + 1

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))

    categories = [{"slug": s, "name": cat_names[s], "count": cat_counts[s]}
                  for s in ORDER if s in cat_counts]
    for s in sorted(cat_counts):
        if s not in ORDER:
            categories.append({"slug": s, "name": cat_names[s], "count": cat_counts[s]})

    volumes = []
    for g in sorted(group_counts):
        ids = [e["id"] for e in entries if (e.get("group") or e.get("volume") or 1) == g] or [0]
        volumes.append({
            "volume": g,
            "total": group_counts[g],
            "chapters": [{
                "title": "All answers",
                "arabic": "",
                "category": "misc",
                "count": group_counts[g],
                "firstId": min(ids),
                "lastId": max(ids),
            }],
        })

    meta = {
        "book": info,
        "total": len(entries),
        "translated": len(entries),
        "categories": categories,
        "volumes": volumes,
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))

    print(f"built {len(entries)} student answers, {len(categories)} categories, "
          f"{len(volumes)} group(s)")


if __name__ == "__main__":
    main()
