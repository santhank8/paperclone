#!/usr/bin/env python3
"""Generate a large synthetic dataset and save to JSON. Run from CR-CA:

  python3 -m crca_llm.parser_model.fill_synthetic_data --count 100000 --out crca_llm/parser_model/synthetic_data.json

Then training will use it automatically (or set CRCA_SYNTHETIC_DATA_PATH).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure we can import from package
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from crca_llm.parser_model.data_generator import generate_many, save_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Fill synthetic equation data to JSON")
    parser.add_argument("--count", type=int, default=100_000, help="Number of (input, equations) pairs to generate")
    parser.add_argument("--out", type=str, default=None, help="Output JSON path (default: parser_model/synthetic_data.json)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    out_path = args.out
    if not out_path:
        out_path = str(Path(__file__).resolve().parent / "synthetic_data.json")
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating {args.count} samples...")
    pairs = generate_many(args.count, seed=args.seed)
    print(f"Saving to {out_path}...")
    save_json(pairs, str(out_path))
    print(f"Done. {len(pairs)} pairs written. Use CRCA_SYNTHETIC_DATA_PATH={out_path} or run train from package dir.")


if __name__ == "__main__":
    main()
