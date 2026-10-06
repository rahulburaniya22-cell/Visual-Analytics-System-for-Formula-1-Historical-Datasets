"""
Fetch lap-by-lap data from FastF1 for seasons 2022-2024.
Uses FastF1's built-in caching to avoid re-downloading.
"""
import sys
import warnings
import fastf1
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore", category=FutureWarning)

CACHE_DIR = Path(__file__).parent.parent / "cache" / "fastf1"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
fastf1.Cache.enable_cache(str(CACHE_DIR))

SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024]


def fetch_all():
    """Download lap data for all races 2018-2024."""
    print("=" * 60, flush=True)
    print("FASTF1: Fetching lap data for 2018-2024", flush=True)
    print("=" * 60, flush=True)

    all_laps = []
    errors = []

    for season in SEASONS:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        races = schedule[schedule["EventFormat"] != "testing"]
        n_races = len(races)
        print(f"\n  Season {season}: {n_races} events", flush=True)

        for idx, (_, event) in enumerate(races.iterrows()):
            round_num = event["RoundNumber"]
            event_name = event["EventName"]
            pct = (idx + 1) / n_races * 100
            bar = "#" * int(pct // 4) + "-" * (25 - int(pct // 4))
            print(f"\r  [{bar}] {pct:5.1f}% | {season} R{round_num:02d} {event_name[:30]}", end="", flush=True)

            try:
                session = fastf1.get_session(season, round_num, "R")
                session.load(telemetry=False, weather=False, messages=False)

                laps = session.laps
                if laps is None or laps.empty:
                    errors.append(f"{season} R{round_num}: no lap data")
                    continue

                race_id = f"{season}_{round_num}"
                lap_df = pd.DataFrame({
                    "race_id": race_id,
                    "season": season,
                    "round": round_num,
                    "driver": laps["Driver"].values,
                    "team": laps["Team"].values,
                    "lap_number": laps["LapNumber"].values,
                    "lap_time_td": laps["LapTime"].values,
                    "position": laps["Position"].values,
                    "compound": laps["Compound"].values,
                    "tire_age_laps": laps["TyreLife"].values,
                    "pit_in_flag": laps["PitInTime"].notna().values,
                    "pit_out_flag": laps["PitOutTime"].notna().values,
                    "sector1_td": laps["Sector1Time"].values,
                    "sector2_td": laps["Sector2Time"].values,
                    "sector3_td": laps["Sector3Time"].values,
                    "is_personal_best": laps["IsPersonalBest"].values if "IsPersonalBest" in laps.columns else False,
                })
                all_laps.append(lap_df)

            except Exception as e:
                errors.append(f"{season} R{round_num}: {str(e)[:80]}")

        print(flush=True)

    print(f"\n  Collected {len(all_laps)} race sessions", flush=True)
    if errors:
        print(f"  Errors ({len(errors)}):", flush=True)
        for e in errors[:10]:
            print(f"    - {e}", flush=True)
        if len(errors) > 10:
            print(f"    ... and {len(errors) - 10} more", flush=True)

    if all_laps:
        combined = pd.concat(all_laps, ignore_index=True)
        print(f"  Total laps: {len(combined):,}", flush=True)
        return combined
    return pd.DataFrame()


if __name__ == "__main__":
    df = fetch_all()
    print(f"\nResult: {len(df)} rows, columns: {list(df.columns)}")
