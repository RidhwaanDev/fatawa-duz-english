#!/usr/bin/env python3
"""Splits the corpus into contiguous, size-balanced translation batches.

Batches keep neighbouring ids together so an agent sees a coherent run of
related rulings (shared chapter, shared terminology).

  python3 scripts/batches.py            # (re)generate data/batches.json
  python3 scripts/batches.py --todo     # list batches with untranslated ids
  python3 scripts/batches.py --status   # progress summary
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
EN = os.path.join(ROOT, "data", "en")
PATH = os.path.join(ROOT, "data", "batches.json")

TARGET_CHARS = 62000
MAX_ITEMS = 26


def build():
    ids = sorted(int(n[:5]) for n in os.listdir(RAW) if n.endswith(".json"))
    sizes = {}
    for fid in ids:
        with open(os.path.join(RAW, f"{fid:05d}.json"), encoding="utf-8") as f:
            d = json.load(f)
        sizes[fid] = (len(d.get("title") or "") + len(d.get("question") or "")
                      + len(d.get("answer") or ""))

    batches, cur, cur_chars = [], [], 0
    for fid in ids:
        n = sizes[fid]
        if cur and (cur_chars + n > TARGET_CHARS or len(cur) >= MAX_ITEMS):
            batches.append(cur)
            cur, cur_chars = [], 0
        cur.append(fid)
        cur_chars += n
    if cur:
        batches.append(cur)

    data = [{"batch": i + 1, "ids": b, "chars": sum(sizes[x] for x in b)}
            for i, b in enumerate(batches)]
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=1)
    print(f"{len(data)} batches, "
          f"{min(len(b['ids']) for b in data)}-{max(len(b['ids']) for b in data)} fatawa each, "
          f"avg {sum(b['chars'] for b in data)//len(data):,} chars")
    return data


def load():
    with open(PATH, encoding="utf-8") as f:
        return json.load(f)


def done(fid):
    p = os.path.join(EN, f"{fid:05d}.md")
    return os.path.exists(p) and os.path.getsize(p) > 80


def main():
    if "--todo" in sys.argv or "--status" in sys.argv:
        data = load()
        pending = [b for b in data if any(not done(i) for i in b["ids"])]
        if "--todo" in sys.argv:
            for b in pending:
                missing = [i for i in b["ids"] if not done(i)]
                print(f"{b['batch']} {missing[0]}-{missing[-1]} {len(missing)}")
            return
        total = sum(len(b["ids"]) for b in data)
        finished = sum(1 for b in data for i in b["ids"] if done(i))
        print(f"batches: {len(data)-len(pending)}/{len(data)} complete")
        print(f"fatawa:  {finished}/{total} translated ({100*finished/total:.1f}%)")
        return
    build()


if __name__ == "__main__":
    main()
