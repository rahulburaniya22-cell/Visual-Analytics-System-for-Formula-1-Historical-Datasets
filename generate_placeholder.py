"""
Generate placeholder Parquet files with realistic F1 data
so the frontend team can start building visualizations immediately.
"""
import pandas as pd
import numpy as np

np.random.seed(42)

# --- Driver/team mappings (realistic 2023 grid) ---
drivers = [
    ("max_verstappen", "VER", "Red Bull", 1),
    ("perez", "PER", "Red Bull", 2),
    ("hamilton", "HAM", "Mercedes", 3),
    ("russell", "RUS", "Mercedes", 4),
    ("leclerc", "LEC", "Ferrari", 5),
    ("sainz", "SAI", "Ferrari", 6),
    ("norris", "NOR", "McLaren", 7),
    ("piastri", "PIA", "McLaren", 8),
    ("alonso", "ALO", "Aston Martin", 9),
    ("stroll", "STR", "Aston Martin", 10),
    ("gasly", "GAS", "Alpine", 11),
    ("ocon", "OCO", "Alpine", 12),
    ("tsunoda", "TSU", "AlphaTauri", 13),
    ("de_vries", "DEV", "AlphaTauri", 14),
    ("bottas", "BOT", "Alfa Romeo", 15),
    ("zhou", "ZHO", "Alfa Romeo", 16),
    ("magnussen", "MAG", "Haas", 17),
    ("hulkenberg", "HUL", "Haas", 18),
    ("albon", "ALB", "Williams", 19),
    ("sargeant", "SAR", "Williams", 20),
]

races_2023 = [
    (1, "Bahrain Grand Prix", "Bahrain International Circuit", "Bahrain", "2023-03-05"),
    (2, "Saudi Arabian Grand Prix", "Jeddah Corniche Circuit", "Saudi Arabia", "2023-03-19"),
    (3, "Australian Grand Prix", "Albert Park Circuit", "Australia", "2023-04-02"),
    (4, "Azerbaijan Grand Prix", "Baku City Circuit", "Azerbaijan", "2023-04-30"),
    (5, "Miami Grand Prix", "Miami International Autodrome", "USA", "2023-05-07"),
]

points_system = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
compounds = ["SOFT", "MEDIUM", "HARD"]

# ============================================================
# 1. standings.parquet — placeholder for 2 seasons, all rounds
# ============================================================
standings_rows = []
for season in [2023, 2024]:
    cumulative = {d[0]: 0 for d in drivers}
    for rnd in range(1, 6):
        positions = np.random.permutation(len(drivers)) + 1
        for i, (driver_id, code, team, _) in enumerate(drivers):
            pts = points_system.get(int(positions[i]), 0)
            cumulative[driver_id] += pts
            standings_rows.append({
                "season": season,
                "round": rnd,
                "driver": driver_id,
                "constructor": team,
                "points": pts,
                "cumulative_points": cumulative[driver_id],
                "position": int(sorted(cumulative, key=cumulative.get, reverse=True).index(driver_id) + 1),
            })

standings_df = pd.DataFrame(standings_rows)
standings_df = standings_df.astype({
    "season": "int16", "round": "int8", "position": "int8",
    "points": "float32", "cumulative_points": "float32"
})

# ============================================================
# 2. results.parquet — placeholder race results
# ============================================================
results_rows = []
for season in [2022, 2023, 2024]:
    for rnd, race_name, circuit, country, date in races_2023:
        finish_order = np.random.permutation(len(drivers))
        for i, (driver_id, code, team, _) in enumerate(drivers):
            finish_pos = int(finish_order[i]) + 1
            dnf = np.random.random() < 0.05
            status = "DNF" if dnf else "Finished"
            if dnf:
                finish_pos = None
            grid = int(np.random.randint(1, 21))
            n_stops = int(np.random.choice([1, 2, 3], p=[0.3, 0.55, 0.15]))
            avg_pit = float(np.random.uniform(22000, 28000))
            results_rows.append({
                "season": season,
                "round": rnd,
                "race_name": race_name,
                "circuit_name": circuit,
                "country": country,
                "date": f"{season}-{date[5:]}",
                "driver": driver_id,
                "constructor": team,
                "grid_position": grid,
                "finish_position": finish_pos,
                "points": float(points_system.get(finish_pos, 0)) if finish_pos else 0.0,
                "status": status,
                "fastest_lap_rank": int(np.random.randint(1, 21)) if not dnf else None,
                "num_pit_stops": n_stops,
                "avg_pit_stop_duration_ms": round(avg_pit, 1) if not dnf else None,
            })

results_df = pd.DataFrame(results_rows)
results_df = results_df.astype({
    "season": "int16", "round": "int8",
    "grid_position": "int8", "points": "float32",
})

# ============================================================
# 3. laps.parquet — placeholder lap data (2022-2024, subset)
# ============================================================
laps_rows = []
for season in [2022, 2023, 2024]:
    for rnd in range(1, 4):  # 3 races per season for placeholder
        race_id = f"{season}_{rnd}"
        total_laps = int(np.random.randint(50, 60))
        for driver_id, code, team, _ in drivers[:10]:  # 10 drivers for size
            compound_plan = ["SOFT"] * 15 + ["MEDIUM"] * 20 + ["HARD"] * (total_laps - 35)
            tire_age = 0
            for lap in range(1, total_laps + 1):
                tire_age += 1
                compound = compound_plan[lap - 1] if lap <= len(compound_plan) else "HARD"
                pit_in = lap in [15, 35]
                pit_out = lap in [16, 36]
                if pit_out:
                    tire_age = 1

                base_time = 85.0 + np.random.normal(0, 1.5)
                if pit_in or pit_out:
                    base_time += np.random.uniform(15, 25)

                s1 = round(base_time * 0.3 + np.random.normal(0, 0.3), 3)
                s2 = round(base_time * 0.4 + np.random.normal(0, 0.3), 3)
                s3 = round(base_time * 0.3 + np.random.normal(0, 0.3), 3)

                laps_rows.append({
                    "race_id": race_id,
                    "season": season,
                    "round": rnd,
                    "driver": driver_id,
                    "team": team,
                    "lap_number": lap,
                    "lap_time_seconds": round(s1 + s2 + s3, 3),
                    "position": int(np.random.randint(1, 11)),
                    "compound": compound,
                    "tire_age_laps": tire_age,
                    "pit_in_flag": pit_in,
                    "pit_out_flag": pit_out,
                    "gap_to_leader_seconds": round(max(0, np.random.exponential(5)), 3),
                    "sector1_time": s1,
                    "sector2_time": s2,
                    "sector3_time": s3,
                })

laps_df = pd.DataFrame(laps_rows)
laps_df = laps_df.astype({
    "season": "int16", "round": "int8", "lap_number": "int16",
    "position": "int8", "tire_age_laps": "int8",
    "lap_time_seconds": "float32",
    "gap_to_leader_seconds": "float32",
    "sector1_time": "float32", "sector2_time": "float32", "sector3_time": "float32",
})

# ============================================================
# 4. stints.parquet — derived from laps
# ============================================================
stints_rows = []
for (race_id, driver), group in laps_df.groupby(["race_id", "driver"]):
    group = group.sort_values("lap_number")
    stint_num = 1
    start_lap = group.iloc[0]["lap_number"]
    prev_compound = group.iloc[0]["compound"]

    for i in range(1, len(group)):
        row = group.iloc[i]
        if row["compound"] != prev_compound:
            stints_rows.append({
                "race_id": race_id,
                "driver": driver,
                "stint_number": stint_num,
                "compound": prev_compound,
                "start_lap": int(start_lap),
                "end_lap": int(group.iloc[i - 1]["lap_number"]),
                "stint_length": int(group.iloc[i - 1]["lap_number"] - start_lap + 1),
            })
            stint_num += 1
            start_lap = row["lap_number"]
            prev_compound = row["compound"]

    # final stint
    stints_rows.append({
        "race_id": race_id,
        "driver": driver,
        "stint_number": stint_num,
        "compound": prev_compound,
        "start_lap": int(start_lap),
        "end_lap": int(group.iloc[-1]["lap_number"]),
        "stint_length": int(group.iloc[-1]["lap_number"] - start_lap + 1),
    })

stints_df = pd.DataFrame(stints_rows)
stints_df = stints_df.astype({"stint_number": "int8", "start_lap": "int16", "end_lap": "int16", "stint_length": "int16"})

# ============================================================
# Write all files
# ============================================================
standings_df.to_parquet("output/standings.parquet", index=False)
results_df.to_parquet("output/results.parquet", index=False)
laps_df.to_parquet("output/laps.parquet", index=False)
stints_df.to_parquet("output/stints.parquet", index=False)

print(f"standings.parquet: {len(standings_df)} rows, cols: {list(standings_df.columns)}")
print(f"results.parquet:   {len(results_df)} rows, cols: {list(results_df.columns)}")
print(f"laps.parquet:      {len(laps_df)} rows, cols: {list(laps_df.columns)}")
print(f"stints.parquet:    {len(stints_df)} rows, cols: {list(stints_df.columns)}")
print("\nDone! Files written to output/")
