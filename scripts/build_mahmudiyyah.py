#!/usr/bin/env python3
"""Builds the Fatawa Mahmudiyyah section of the site.

Reads data/mahmudiyyah/source.json and emits, into public/data/mahmudiyyah/:
  meta.json          categories, volumes, counts, book info
  index.json         compact parallel-array search index
  fatwa/<id>.json    full record

The output shapes deliberately mirror scripts/build_site.py so the web app can
render either collection through the same views.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_site import searchable, snippet

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "mahmudiyyah", "source.json")
OUT = os.path.join(ROOT, "public", "data", "mahmudiyyah")

# Arabic chapter heading -> (english name, slug). Shared vocabulary with the
# Zakariyya taxonomy so the two collections filter alike.
CHAPTER_MAP = {
    "كتاب الإيمان والعقائد": ("Faith & Belief", "faith"),
    "كتاب الطهارة": ("Purification", "purification"),
    "كتاب الصلاة": ("Prayer", "prayer"),
    "كتاب الزكاة": ("Zakat", "zakat"),
    "كتاب الصوم": ("Fasting", "fasting"),
    "كتاب الحج": ("Hajj & Umrah", "hajj"),
    "كتاب النكاح": ("Marriage", "marriage"),
    "كتاب الطلاق": ("Divorce", "divorce"),
    "كتاب البيوع": ("Trade & Business", "trade"),
    "كتاب الفرائض": ("Inheritance", "inheritance"),
    "كتاب الحظر والإباحة": ("Lawful & Unlawful", "lawful"),
}
ORDER = ["faith", "purification", "prayer", "zakat", "fasting", "hajj", "marriage",
         "divorce", "trade", "inheritance", "lawful", "misc"]


def classify(chapter):
    return CHAPTER_MAP.get((chapter or "").strip(), ("Miscellaneous", "misc"))


def scan_url(archive_id, volume, pdf_page):
    """Deep link to the scanned page on archive.org.

    The reader's n-index is zero-based, so it trails the 1-based PDF page by one.
    """
    return (f"https://archive.org/details/{archive_id}/"
            f"{archive_id}-Vol-{volume:02d}/page/n{pdf_page - 1}/mode/2up")


def main():
    with open(SRC, encoding="utf-8") as f:
        src = json.load(f)

    book = src["book"]
    entries = sorted(src["entries"], key=lambda e: e["id"])
    os.makedirs(os.path.join(OUT, "fatwa"), exist_ok=True)

    idx = {"id": [], "t": [], "c": [], "v": [], "s": [], "k": [], "e": []}
    cat_counts, cat_names = {}, {}
    vol_counts, vol_chapters = {}, {}

    for e in entries:
        name, slug = classify(e.get("chapter"))
        cat_names[slug] = name
        vol = e["volume"]

        # An entry may supply either a summary of the ruling or full text.
        # Full text is used whenever it is present, and the Urdu original is
        # carried alongside it exactly as the Zakariyya records do.
        urdu_q = (e.get("urduQuestion") or "").strip()
        urdu_a = (e.get("urduAnswer") or "").strip()
        mode = e.get("mode") or ("full" if (urdu_q or urdu_a) else "summary")

        record = {
            "id": e["id"],
            "title": e["title"],
            "question": e["question"],
            "answer": e["answer"],
            "translated": True,
            "mode": mode,
            "category": name,
            "categorySlug": slug,
            "volume": vol,
            "page": e["page"],
            "chapter": e.get("chapter") or "",
            "section": e.get("section") or "",
            "references": e.get("references") or [],
            "signedBy": e.get("signedBy") or "",
            "scanUrl": scan_url(book["archiveId"], vol, e["pdfPage"]),
            "urdu": {"title": e.get("urduTitle") or "",
                     "question": urdu_q,
                     "answer": urdu_a},
        }
        with open(os.path.join(OUT, "fatwa", f"{e['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, separators=(",", ":"))

        idx["id"].append(e["id"])
        idx["t"].append(e["title"])
        idx["c"].append(slug)
        idx["v"].append(vol)
        idx["s"].append(snippet(e["question"]))
        idx["k"].append(searchable(e["title"], e["question"], e["answer"]))
        idx["e"].append(1)

        cat_counts[slug] = cat_counts.get(slug, 0) + 1
        vol_counts[vol] = vol_counts.get(vol, 0) + 1
        vol_chapters.setdefault(vol, {}).setdefault(slug, {"title": name, "arabic": e.get("chapter") or "",
                                                           "category": slug, "count": 0,
                                                           "firstId": e["id"], "lastId": e["id"]})
        ch = vol_chapters[vol][slug]
        ch["count"] += 1
        ch["firstId"] = min(ch["firstId"], e["id"])
        ch["lastId"] = max(ch["lastId"], e["id"])

    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))

    categories = [{"slug": s, "name": cat_names[s], "count": cat_counts[s]}
                  for s in ORDER if s in cat_counts]
    for s in sorted(cat_counts):
        if s not in ORDER:
            categories.append({"slug": s, "name": cat_names[s], "count": cat_counts[s]})

    volumes = [{"volume": v, "total": vol_counts[v],
                "chapters": list(vol_chapters[v].values())}
               for v in sorted(vol_counts)]

    meta = {
        "book": book,
        "total": len(entries),
        "translated": len(entries),
        "categories": categories,
        "volumes": volumes,
    }
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))

    print(f"built {len(entries)} Mahmudiyyah entries, "
          f"{len(categories)} categories, {len(volumes)} volume(s)")


if __name__ == "__main__":
    main()
