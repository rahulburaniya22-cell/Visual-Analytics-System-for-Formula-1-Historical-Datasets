"""
Precompute a 3-D UMAP embedding of every driver's career "style fingerprint".

Each driver becomes one point in 3-D space; drivers with similar career
profiles (pace, reliability, qualifying strength, scoring rate, longevity)
land near each other. The result is written as a small JSON the frontend
renders directly — no UMAP is ever computed in the browser.

Run:  python pipeline/build_umap.py
Output: frontend/public/driver_umap_3d.json
"""
import json
import numpy as np
import pandas as pd
from pathlib import Path

HF_BASE = "https://huggingface.co/datasets/Aman2406/f1-visual-analytics/resolve/main/data"
OUTPUT = Path(__file__).parent.parent / "frontend" / "public" / "driver_umap_3d.json"

MIN_RACES = 10  # drivers with too few starts distort the manifold

# Feature columns fed to UMAP (all per-driver, normalised downstream)
FEATURES = [
    "win_rate", "podium_rate", "points_finish_rate", "pole_rate",
    "fastest_lap_rate", "finish_rate", "avg_finish", "avg_grid",
    "quali_race_delta", "points_per_race", "seasons", "races",
]


def load_results():
    print("Loading results.parquet from HuggingFace…", flush=True)
    return pd.read_parquet(f"{HF_BASE}/results.parquet")


def build_features(df):
    print("Building per-driver feature vectors…", flush=True)
    rows = []
    for driver, g in df.groupby("driver"):
        races = len(g)
        if races < MIN_RACES:
            continue
        fin = g["finish_position"].dropna()
        grid = g["grid_position"].dropna()
        wins = (g["finish_position"] == 1).sum()
        podiums = (g["finish_position"] <= 3).sum()
        points_fin = (g["finish_position"] <= 10).sum()
        poles = (g["grid_position"] == 1).sum()
        fastest = (g["fastest_lap_rank"] == 1).sum()
        finished = g["finish_position"].notna().sum()
        # qualifying vs race: positive = gains places on Sunday
        merged = g.dropna(subset=["finish_position", "grid_position"])
        quali_race_delta = (
            (merged["grid_position"] - merged["finish_position"]).mean()
            if len(merged) else 0.0
        )
        rows.append({
            "driver": driver,
            "team": g.sort_values(["season", "round"]).iloc[-1]["constructor"],
            "races": races,
            "wins": int(wins),
            "podiums": int(podiums),
            "poles": int(poles),
            "points": float(g["points"].sum()),
            "seasons": int(g["season"].nunique()),
            "avg_finish": float(fin.mean()) if len(fin) else 22.0,
            "avg_grid": float(grid.mean()) if len(grid) else 22.0,
            "win_rate": wins / races,
            "podium_rate": podiums / races,
            "points_finish_rate": points_fin / races,
            "pole_rate": poles / races,
            "fastest_lap_rate": fastest / races,
            "finish_rate": finished / races,
            "quali_race_delta": float(quali_race_delta),
            "points_per_race": float(g["points"].sum()) / races,
        })
    feat = pd.DataFrame(rows)
    print(f"  {len(feat)} drivers with >= {MIN_RACES} races", flush=True)
    return feat


# The two UMAP hyper-parameters exposed as sliders in the frontend.
# One embedding is precomputed per (n_neighbors, min_dist) combination so the
# browser only ever switches between saved results — it never runs UMAP.
N_NEIGHBORS = [5, 15, 30, 50]
MIN_DIST = [0.0, 0.1, 0.25, 0.5]


def one_embedding(X, n_neighbors, min_dist, n):
    import umap
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=min(n_neighbors, n - 1),
        min_dist=min_dist,
        metric="euclidean",
        random_state=42,
    )
    emb = reducer.fit_transform(X)
    emb = emb - emb.mean(axis=0)
    scale = np.abs(emb).max() or 1.0
    return emb / scale  # normalise to ~[-1, 1]


def run_umap_grid(feat):
    from sklearn.preprocessing import StandardScaler
    X = StandardScaler().fit_transform(feat[FEATURES].to_numpy(dtype=np.float64))
    n = len(feat)
    embeddings = {}
    for nn in N_NEIGHBORS:
        for md in MIN_DIST:
            key = f"{nn}_{md}"
            print(f"  UMAP n_neighbors={nn} min_dist={md}…", flush=True)
            emb = one_embedding(X, nn, md, n)
            embeddings[key] = [[round(float(v), 4) for v in row] for row in emb]
    return embeddings


def main():
    df = load_results()
    feat = build_features(df).reset_index(drop=True)

    print("Running 3-D UMAP grid…", flush=True)
    embeddings = run_umap_grid(feat)

    drivers = []
    for _, r in feat.iterrows():
        drivers.append({
            "driver": r["driver"],
            "team": r["team"],
            "races": int(r["races"]),
            "wins": int(r["wins"]),
            "podiums": int(r["podiums"]),
            "poles": int(r["poles"]),
            "points": round(float(r["points"]), 1),
            "seasons": int(r["seasons"]),
            "avg_finish": round(float(r["avg_finish"]), 2),
            "win_rate": round(float(r["win_rate"]), 4),
            "podium_rate": round(float(r["podium_rate"]), 4),
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump({
            "drivers": drivers,
            "params": {"n_neighbors": N_NEIGHBORS, "min_dist": MIN_DIST},
            "default": {"n_neighbors": 15, "min_dist": 0.1},
            "embeddings": embeddings,
        }, f)
    print(f"Wrote {len(drivers)} drivers x {len(embeddings)} embeddings -> {OUTPUT}", flush=True)


if __name__ == "__main__":
    main()
