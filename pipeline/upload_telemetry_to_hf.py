"""
Upload the simulator's parquet outputs (telemetry, circuits, track_status)
to the Aman2406/f1-visual-analytics HuggingFace dataset, under data/.

These files are gitignored (real data, not meant to live in the repo), so
without this step the deployed frontend's HTTP fallback to HuggingFace 404s
and the race simulator shows "Replay unavailable".

Requires being logged in first: `hf auth login` (prompts for a HF token
with write access to the dataset repo).

Usage: python pipeline/upload_telemetry_to_hf.py [--dir frontend/public]
"""

import argparse
from pathlib import Path

from huggingface_hub import HfApi

REPO_ID = "Aman2406/f1-visual-analytics"
FILES = ["telemetry.parquet", "circuits.parquet", "track_status.parquet"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="frontend/public", help="Directory containing the parquet files")
    args = parser.parse_args()

    src_dir = Path(args.dir)
    api = HfApi()

    for name in FILES:
        path = src_dir / name
        if not path.exists():
            print(f"skip {name}: not found in {src_dir}")
            continue
        print(f"uploading {name} ({path.stat().st_size / 1024:.0f} KB)...")
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=f"data/{name}",
            repo_id=REPO_ID,
            repo_type="dataset",
        )
        print(f"  done -> https://huggingface.co/datasets/{REPO_ID}/blob/main/data/{name}")


if __name__ == "__main__":
    main()
