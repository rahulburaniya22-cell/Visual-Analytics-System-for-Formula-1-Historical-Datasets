#!/usr/bin/env python3
"""
Main pipeline runner. Fetches all data and produces final Parquet files.
Run: python run_pipeline.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from pipeline.fetch_jolpica import fetch_all as fetch_jolpica
from pipeline.fetch_fastf1 import fetch_all as fetch_fastf1
from pipeline.build_parquets import (
    build_standings, build_results, build_laps, build_stints,
    build_driver_mapping, load_json, SEASONS
)


def main():
    start = time.time()

    print("\n" + "=" * 60)
    print("  F1 DATA PIPELINE — CS661 Big Data Visual Analytics")
    print("=" * 60 + "\n")

    # Step 1: Fetch Jolpica data
    print("[STEP 1/4] Fetching Jolpica API data...\n")
    season_rounds = fetch_jolpica()

    # Step 2: Fetch FastF1 data
    print("\n[STEP 2/4] Fetching FastF1 lap data...\n")
    raw_laps = fetch_fastf1()

    # Step 3: Build driver mapping
    print("\n[STEP 3/4] Building driver code mapping...")
    results_data = []
    for season in SEASONS:
        data = load_json(f"results_{season}")
        if data:
            results_data.append(data)
    driver_mapping = build_driver_mapping(results_data)
    print(f"  Mapped {len(driver_mapping)} driver codes (e.g., VER -> max_verstappen)")

    # Step 4: Build final parquets
    print("\n[STEP 4/4] Building final Parquet files...\n")
    build_standings()
    build_results()
    laps_df = build_laps(raw_laps, driver_mapping)
    build_stints(laps_df)

    elapsed = time.time() - start
    mins = int(elapsed // 60)
    secs = int(elapsed % 60)
    print(f"\n{'=' * 60}")
    print(f"  PIPELINE COMPLETE in {mins}m {secs}s")
    print(f"  Output files in: {Path(__file__).parent / 'output'}")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
