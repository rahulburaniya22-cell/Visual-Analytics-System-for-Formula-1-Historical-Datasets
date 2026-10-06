"""
Fetch all needed data from Jolpica-F1 API (Ergast replacement).
Endpoints: race results, qualifying, pit stops for seasons 2000-2024.
Caches responses to disk so reruns don't re-fetch.
Rate limit: 200 requests/hour — script will pause when needed.
"""
import json
import os
import sys
import time
import requests
from pathlib import Path

BASE_URL = "https://api.jolpi.ca/ergast/f1"
CACHE_DIR = Path(__file__).parent.parent / "cache" / "jolpica"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SEASONS = list(range(2000, 2025))  # 2000-2024
RATE_LIMIT = 200
RATE_WINDOW = 3600  # seconds
PAGE_LIMIT = 100  # API hard caps at 100 results per page

request_timestamps = []


def rate_limit_wait():
    """Block if we've hit 200 requests in the last hour."""
    now = time.time()
    while request_timestamps and request_timestamps[0] < now - RATE_WINDOW:
        request_timestamps.pop(0)
    if len(request_timestamps) >= RATE_LIMIT:
        wait_time = request_timestamps[0] + RATE_WINDOW - now + 1
        mins = int(wait_time // 60)
        secs = int(wait_time % 60)
        print(f"\n  [RATE LIMIT] Hit 200 requests/hr. Waiting {mins}m {secs}s...", flush=True)
        time.sleep(wait_time)


def fetch_single(url):
    """Fetch a single URL with rate limiting (no caching, used internally)."""
    rate_limit_wait()
    resp = requests.get(url, timeout=30)
    request_timestamps.append(time.time())

    if resp.status_code == 429:
        print("\n  [429] Rate limited by server. Waiting 60s...", flush=True)
        time.sleep(60)
        return fetch_single(url)

    resp.raise_for_status()
    return resp.json()


def fetch_paginated(base_url, cache_key, table_key, list_key):
    """
    Fetch all pages of a paginated endpoint and merge into one response.
    table_key: e.g. 'RaceTable'
    list_key: e.g. 'Races'
    Caches the fully-merged result.
    """
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)

    # First page
    url = f"{base_url}?limit={PAGE_LIMIT}&offset=0"
    data = fetch_single(url)
    total = int(data["MRData"]["total"])
    all_items = data["MRData"][table_key][list_key]

    # Fetch remaining pages
    offset = PAGE_LIMIT
    while offset < total:
        url = f"{base_url}?limit={PAGE_LIMIT}&offset={offset}"
        page_data = fetch_single(url)
        page_items = page_data["MRData"][table_key][list_key]
        all_items.extend(page_items)
        offset += PAGE_LIMIT

    # Store merged result
    data["MRData"][table_key][list_key] = all_items
    data["MRData"]["total"] = str(len(all_items))
    data["MRData"]["limit"] = str(len(all_items))

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w") as f:
        json.dump(data, f)
    return data


def fetch_simple(url, cache_key):
    """Fetch a single (non-paginated) URL with caching."""
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        with open(cache_file) as f:
            return json.load(f)

    data = fetch_single(url)

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w") as f:
        json.dump(data, f)
    return data


def fetch_all():
    """Main fetch loop with progress reporting."""
    # Phase 1: Results + Qualifying (paginated, multiple requests per season)
    print("=" * 60, flush=True)
    print("PHASE 1: Race Results + Qualifying (paginated)", flush=True)
    print("=" * 60, flush=True)

    season_rounds = {}
    for i, season in enumerate(SEASONS):
        pct = (i + 1) / len(SEASONS) * 100
        bar = "#" * int(pct // 4) + "-" * (25 - int(pct // 4))
        print(f"\r  [{bar}] {pct:5.1f}% | Results+Quali {season}", end="", flush=True)

        # Results (paginated)
        data = fetch_paginated(
            f"{BASE_URL}/{season}/results/",
            f"results_{season}",
            "RaceTable", "Races"
        )
        races = data["MRData"]["RaceTable"]["Races"]
        season_rounds[season] = len(races)

        # Qualifying (paginated)
        fetch_paginated(
            f"{BASE_URL}/{season}/qualifying/",
            f"qualifying_{season}",
            "RaceTable", "Races"
        )

    total_rounds = sum(season_rounds.values())
    print(f"\n  Done! {len(SEASONS)} seasons, {total_rounds} total rounds found.\n", flush=True)

    # Phase 2: Pit stops (per-round, usually <100 so no pagination needed)
    print("=" * 60, flush=True)
    print(f"PHASE 2: Pit Stops ({total_rounds} requests, per-round)", flush=True)
    print("=" * 60, flush=True)

    completed = 0
    for season in SEASONS:
        n_rounds = season_rounds[season]
        for rnd in range(1, n_rounds + 1):
            completed += 1
            pct = completed / total_rounds * 100
            bar = "#" * int(pct // 4) + "-" * (25 - int(pct // 4))
            print(f"\r  [{bar}] {pct:5.1f}% | Pit stops {season} R{rnd:02d} ({completed}/{total_rounds})", end="", flush=True)

            fetch_simple(
                f"{BASE_URL}/{season}/{rnd}/pitstops/?limit=100",
                f"pitstops_{season}_{rnd}"
            )

    print(f"\n  Done! {completed} pit stop requests completed.\n", flush=True)

    # Summary
    cached = 0
    for season in SEASONS:
        if (CACHE_DIR / f"results_{season}.json").exists():
            cached += 1
        if (CACHE_DIR / f"qualifying_{season}.json").exists():
            cached += 1
    print("=" * 60, flush=True)
    print(f"JOLPICA COMPLETE", flush=True)
    print(f"  Fresh API requests this run: {len(request_timestamps)}", flush=True)
    print("=" * 60, flush=True)

    return season_rounds


if __name__ == "__main__":
    fetch_all()
