#!/usr/bin/env python3
"""Polite, resumable scraper for the fduz.org fatwa API.

Fetches the 9 volume tables-of-contents and every individual fatwa record.
Designed to avoid rate limiting: low concurrency, inter-request delay,
exponential backoff on 429/5xx, and skips anything already on disk.
"""
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = "https://fduz.org"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
TOC = os.path.join(ROOT, "data", "toc")

WORKERS = 2
DELAY = 0.6          # seconds each worker sleeps between requests
MAX_RETRIES = 6
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

_print_lock = threading.Lock()
_cooldown = threading.Event()
_cooldown.set()


def log(msg):
    with _print_lock:
        print(msg, flush=True)


def get(path):
    """GET a JSON path with backoff. Returns parsed JSON or None."""
    url = BASE + path
    for attempt in range(MAX_RETRIES):
        _cooldown.wait()
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Accept": "application/json",
            "Referer": BASE + "/",
        })
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                wait = min(300, (2 ** attempt) * 15) + random.uniform(0, 5)
                log(f"  ! {e.code} on {path} -> global cooldown {wait:.0f}s")
                # Pause every worker, not just this one.
                if _cooldown.is_set():
                    _cooldown.clear()
                    time.sleep(wait)
                    _cooldown.set()
                else:
                    _cooldown.wait()
                continue
            if e.code == 404:
                return None
            log(f"  ! HTTP {e.code} on {path}")
            return None
        except Exception as e:
            wait = min(60, (2 ** attempt) * 3) + random.uniform(0, 2)
            log(f"  ! {type(e).__name__} on {path} -> retry in {wait:.0f}s")
            time.sleep(wait)
    log(f"  !! gave up on {path}")
    return None


def scrape_toc():
    volumes = []
    stats = get("/api/stats")
    if stats:
        with open(os.path.join(TOC, "stats.json"), "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        volumes = [v["id"] for v in stats["stats"]["volumes"]]
    for vol in volumes:
        dest = os.path.join(TOC, f"volume-{vol}.json")
        if os.path.exists(dest):
            continue
        time.sleep(DELAY)
        data = get(f"/api/volume/{vol}/contents")
        if data:
            with open(dest, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            log(f"toc volume {vol}: {data['contents']['total']} fatawa")
    return volumes


def id_ranges():
    """Derive the global id range from the volume tables of contents."""
    ids = []
    for name in sorted(os.listdir(TOC)):
        if not name.startswith("volume-"):
            continue
        with open(os.path.join(TOC, name), encoding="utf-8") as f:
            c = json.load(f)["contents"]
        for ch in c["chapters"]:
            ids.append(ch["lastId"])
    return 1, max(ids) if ids else 0


def fetch_one(fid):
    dest = os.path.join(RAW, f"{fid:05d}.json")
    if os.path.exists(dest) and os.path.getsize(dest) > 40:
        return "skip"
    data = get(f"/api/fatwa/{fid}")
    if not data or not data.get("fatwa"):
        return "miss"
    # Neighbours are redundant (each is fetched on its own turn); drop them.
    record = data["fatwa"]
    tmp = dest + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False)
    os.replace(tmp, dest)
    return "ok"


def main():
    lo, hi = 1, 0
    scrape_toc()
    lo, hi = id_ranges()
    if len(sys.argv) > 2:
        lo, hi = int(sys.argv[1]), int(sys.argv[2])
    log(f"scraping ids {lo}..{hi}")

    todo = [i for i in range(lo, hi + 1)
            if not os.path.exists(os.path.join(RAW, f"{i:05d}.json"))]
    log(f"{hi - lo + 1 - len(todo)} already cached, {len(todo)} to fetch")

    counts = {"ok": 0, "skip": 0, "miss": 0}
    lock = threading.Lock()
    start = time.time()

    def worker(chunk):
        for fid in chunk:
            r = fetch_one(fid)
            with lock:
                counts[r] += 1
                n = counts["ok"] + counts["miss"]
                if n and n % 100 == 0:
                    el = time.time() - start
                    rate = n / el if el else 0
                    left = (len(todo) - n) / rate if rate else 0
                    log(f"  {n}/{len(todo)} fetched  {rate:.1f}/s  eta {left/60:.0f}m")
            time.sleep(DELAY)

    chunks = [todo[i::WORKERS] for i in range(WORKERS)]
    threads = [threading.Thread(target=worker, args=(c,), daemon=True) for c in chunks]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    log(f"done: {counts}  in {(time.time()-start)/60:.1f}m")


if __name__ == "__main__":
    main()
