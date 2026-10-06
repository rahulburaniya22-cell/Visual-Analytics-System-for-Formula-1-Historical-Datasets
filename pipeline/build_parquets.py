"""
Process raw cached data into final Parquet files.
Run this after fetch_jolpica.py and fetch_fastf1.py have completed.
"""
import json
import sys
import numpy as np
import pandas as pd
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "cache" / "jolpica"
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SEASONS = list(range(2000, 2025))

# Points system (modern, post-2010 for simplicity; earlier seasons handled from data)
POINTS_MAP = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}

# Driver ID mapping: FastF1 3-letter code -> Jolpica driverId
# This will be built dynamically from the data we have, plus known mappings
FASTF1_TO_JOLPICA = {}


def load_json(cache_key):
    path = CACHE_DIR / f"{cache_key}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def build_driver_mapping(results_data_all):
    """Build mapping from FastF1 3-letter codes to Jolpica driver IDs."""
    mapping = {}
    for season_data in results_data_all:
        if not season_data:
            continue
        races = season_data["MRData"]["RaceTable"]["Races"]
        for race in races:
            for result in race.get("Results", []):
                driver = result["Driver"]
                driver_id = driver["driverId"]
                code = driver.get("code", "")
                if code:
                    mapping[code] = driver_id
    return mapping


def build_standings():
    """Build standings.parquet by computing cumulative points from results."""
    print("Building standings.parquet...", flush=True)
    rows = []

    for season in SEASONS:
        data = load_json(f"results_{season}")
        if not data:
            continue
        races = data["MRData"]["RaceTable"]["Races"]

        # Track cumulative points per driver
        cumulative = {}
        driver_constructors = {}

        for race in races:
            rnd = int(race["round"])
            for result in race.get("Results", []):
                driver_id = result["Driver"]["driverId"]
                constructor = result["Constructor"]["name"]
                pts = float(result.get("points", 0))

                cumulative[driver_id] = cumulative.get(driver_id, 0) + pts
                driver_constructors[driver_id] = constructor

            # Compute positions based on cumulative points
            sorted_drivers = sorted(cumulative.items(), key=lambda x: -x[1])
            position_map = {d: i + 1 for i, (d, _) in enumerate(sorted_drivers)}

            for driver_id, cum_pts in cumulative.items():
                # Find points scored this round
                round_pts = 0
                for result in race.get("Results", []):
                    if result["Driver"]["driverId"] == driver_id:
                        round_pts = float(result.get("points", 0))
                        break

                rows.append({
                    "season": season,
                    "round": rnd,
                    "driver": driver_id,
                    "constructor": driver_constructors[driver_id],
                    "points": round_pts,
                    "cumulative_points": cum_pts,
                    "position": position_map[driver_id],
                })

    df = pd.DataFrame(rows)
    df = df.astype({
        "season": "int16", "round": "int8", "position": "int16",
        "points": "float32", "cumulative_points": "float32"
    })
    df.to_parquet(OUTPUT_DIR / "standings.parquet", index=False)
    print(f"  standings.parquet: {len(df):,} rows", flush=True)
    return df


def build_results():
    """Build results.parquet combining race results, qualifying, and pit stop data."""
    print("Building results.parquet...", flush=True)
    rows = []

    for season in SEASONS:
        results_data = load_json(f"results_{season}")
        quali_data = load_json(f"qualifying_{season}")

        if not results_data:
            continue

        races = results_data["MRData"]["RaceTable"]["Races"]

        # Index qualifying by (round, driverId) -> grid position
        quali_index = {}
        if quali_data:
            for race in quali_data["MRData"]["RaceTable"]["Races"]:
                rnd = int(race["round"])
                for q in race.get("QualifyingResults", []):
                    key = (rnd, q["Driver"]["driverId"])
                    quali_index[key] = int(q["position"])

        for race in races:
            rnd = int(race["round"])
            race_name = race["raceName"]
            circuit_name = race["Circuit"]["circuitName"]
            country = race["Circuit"]["Location"]["country"]
            date = race["date"]

            # Load pit stops for this round
            pit_data = load_json(f"pitstops_{season}_{rnd}")
            pit_index = {}  # driverId -> list of durations
            if pit_data:
                pit_races = pit_data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
                if pit_races:
                    for stop in pit_races[0].get("PitStops", []):
                        did = stop["driverId"]
                        duration_str = stop.get("duration", "")
                        try:
                            # Duration is in seconds (e.g., "23.456")
                            dur_ms = float(duration_str) * 1000
                            pit_index.setdefault(did, []).append(dur_ms)
                        except (ValueError, TypeError):
                            pass

            for result in race.get("Results", []):
                driver_id = result["Driver"]["driverId"]
                constructor = result["Constructor"]["name"]

                # Finish position handling for DNFs
                status = result.get("status", "")
                pos_text = result.get("position", "")
                if status == "Finished" or status.startswith("+"):
                    finish_pos = int(pos_text) if pos_text else None
                    clean_status = "Finished"
                elif pos_text and pos_text.isdigit():
                    # Classified but didn't finish on lead lap
                    finish_pos = int(pos_text)
                    clean_status = "Finished" if "Lap" in status or status == "Finished" else status
                else:
                    finish_pos = None
                    clean_status = status if status else "DNF"

                # Actually, Ergast gives position for all classified drivers
                # Let's use a simpler approach: if status is purely "Finished" or "+N Lap(s)", they finished
                if status == "Finished" or "Lap" in status:
                    finish_pos = int(result.get("position", 0)) or None
                    clean_status = "Finished"
                else:
                    # Could still be classified (they give position even for some DNFs)
                    finish_pos = int(result["position"]) if result.get("position", "").isdigit() else None
                    clean_status = status

                grid = int(result.get("grid", 0)) or None
                # Prefer qualifying position from quali endpoint
                quali_pos = quali_index.get((rnd, driver_id))
                grid_position = quali_pos if quali_pos else grid

                pts = float(result.get("points", 0))
                fl_rank = result.get("FastestLap", {}).get("rank")
                fl_rank = int(fl_rank) if fl_rank else None

                pit_stops_list = pit_index.get(driver_id, [])
                num_stops = len(pit_stops_list)
                avg_pit = round(sum(pit_stops_list) / len(pit_stops_list), 1) if pit_stops_list else None

                rows.append({
                    "season": season,
                    "round": rnd,
                    "race_name": race_name,
                    "circuit_name": circuit_name,
                    "country": country,
                    "date": date,
                    "driver": driver_id,
                    "constructor": constructor,
                    "grid_position": grid_position,
                    "finish_position": finish_pos,
                    "points": pts,
                    "status": clean_status,
                    "fastest_lap_rank": fl_rank,
                    "num_pit_stops": num_stops,
                    "avg_pit_stop_duration_ms": avg_pit,
                })

    df = pd.DataFrame(rows)
    df["grid_position"] = pd.array(df["grid_position"], dtype=pd.Int16Dtype())
    df["finish_position"] = pd.array(df["finish_position"], dtype=pd.Int16Dtype())
    df["fastest_lap_rank"] = pd.array(df["fastest_lap_rank"], dtype=pd.Int16Dtype())
    df["num_pit_stops"] = pd.array(df["num_pit_stops"], dtype=pd.Int8Dtype())
    df = df.astype({"season": "int16", "round": "int8", "points": "float32"})
    df.to_parquet(OUTPUT_DIR / "results.parquet", index=False)
    print(f"  results.parquet: {len(df):,} rows", flush=True)
    return df


def build_laps(raw_laps_df, driver_mapping):
    """Build laps.parquet from FastF1 raw data."""
    print("Building laps.parquet...", flush=True)

    if raw_laps_df is None or raw_laps_df.empty:
        print("  WARNING: No FastF1 data available. Skipping laps.parquet.", flush=True)
        return pd.DataFrame()

    df = raw_laps_df.copy()

    # Map FastF1 driver codes to Jolpica IDs
    df["driver"] = df["driver"].map(lambda x: driver_mapping.get(x, x.lower()))

    # Convert timedelta columns to seconds
    def td_to_seconds(val):
        if pd.isna(val):
            return None
        try:
            return val.total_seconds()
        except (AttributeError, TypeError):
            try:
                return float(val) / 1e9  # nanoseconds
            except (TypeError, ValueError):
                return None

    df["lap_time_seconds"] = df["lap_time_td"].apply(td_to_seconds)
    df["sector1_time"] = df["sector1_td"].apply(td_to_seconds)
    df["sector2_time"] = df["sector2_td"].apply(td_to_seconds)
    df["sector3_time"] = df["sector3_td"].apply(td_to_seconds)

    # Compute gap to leader from cumulative lap times
    df["lap_number"] = df["lap_number"].astype("Int16")
    df["cum_time"] = df.groupby(["race_id", "driver"])["lap_time_seconds"].cumsum()

    # For each race+lap, find the leader's cumulative time
    leader_time = df.groupby(["race_id", "lap_number"])["cum_time"].min().reset_index()
    leader_time.columns = ["race_id", "lap_number", "leader_cum_time"]
    df = df.merge(leader_time, on=["race_id", "lap_number"], how="left")
    df["gap_to_leader_seconds"] = df["cum_time"] - df["leader_cum_time"]

    # Clean up
    df = df.drop(columns=["lap_time_td", "sector1_td", "sector2_td", "sector3_td",
                           "cum_time", "leader_cum_time", "is_personal_best"])

    # Type casting
    df["season"] = df["season"].astype("int16")
    df["round"] = df["round"].astype("int8")
    df["lap_time_seconds"] = df["lap_time_seconds"].astype("float32")
    df["gap_to_leader_seconds"] = df["gap_to_leader_seconds"].astype("float32")
    df["sector1_time"] = df["sector1_time"].astype("float32")
    df["sector2_time"] = df["sector2_time"].astype("float32")
    df["sector3_time"] = df["sector3_time"].astype("float32")
    df["position"] = pd.array(df["position"], dtype=pd.Int8Dtype())
    df["tire_age_laps"] = pd.array(df["tire_age_laps"], dtype=pd.Int16Dtype())

    df.to_parquet(OUTPUT_DIR / "laps.parquet", index=False)
    print(f"  laps.parquet: {len(df):,} rows", flush=True)
    return df


def build_stints(laps_df):
    """Build stints.parquet from laps data."""
    print("Building stints.parquet...", flush=True)

    if laps_df is None or laps_df.empty:
        print("  WARNING: No laps data. Skipping stints.parquet.", flush=True)
        return pd.DataFrame()

    rows = []
    for (race_id, driver), group in laps_df.groupby(["race_id", "driver"]):
        group = group.sort_values("lap_number").reset_index(drop=True)
        if group.empty:
            continue

        stint_num = 1
        start_lap = int(group.iloc[0]["lap_number"])
        prev_compound = group.iloc[0]["compound"]

        for i in range(1, len(group)):
            curr_compound = group.iloc[i]["compound"]
            if curr_compound != prev_compound and pd.notna(curr_compound):
                end_lap = int(group.iloc[i - 1]["lap_number"])
                rows.append({
                    "race_id": race_id,
                    "driver": driver,
                    "stint_number": stint_num,
                    "compound": prev_compound,
                    "start_lap": start_lap,
                    "end_lap": end_lap,
                    "stint_length": end_lap - start_lap + 1,
                })
                stint_num += 1
                start_lap = int(group.iloc[i]["lap_number"])
                prev_compound = curr_compound

        # Final stint
        end_lap = int(group.iloc[-1]["lap_number"])
        rows.append({
            "race_id": race_id,
            "driver": driver,
            "stint_number": stint_num,
            "compound": prev_compound,
            "start_lap": start_lap,
            "end_lap": end_lap,
            "stint_length": end_lap - start_lap + 1,
        })

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.astype({
            "stint_number": "int8",
            "start_lap": "int16",
            "end_lap": "int16",
            "stint_length": "int16",
        })
    df.to_parquet(OUTPUT_DIR / "stints.parquet", index=False)
    print(f"  stints.parquet: {len(df):,} rows", flush=True)
    return df


if __name__ == "__main__":
    build_standings()
    build_results()
    print("\nNote: laps.parquet and stints.parquet require FastF1 data.")
    print("Run the full pipeline via run_pipeline.py to build all 4 files.")
