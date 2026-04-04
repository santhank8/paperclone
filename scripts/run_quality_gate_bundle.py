#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path("/Users/daehan/Documents/persona/paperclip/scripts")


def run_json_command(args: list[str]) -> dict[str, Any]:
    raw = subprocess.check_output(args, text=True)
    return json.loads(raw)


def maybe_run(script_name: str, args: list[str], should_run: bool) -> dict[str, Any] | None:
    if not should_run:
        return None
    script = ROOT / script_name
    return run_json_command([sys.executable, str(script), *args])


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the local quality gate CLI bundle against a draft run directory.")
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--approved-topic", default="")
    parser.add_argument("--research-json")
    parser.add_argument("--image-json")
    parser.add_argument("--out")
    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    draft_json = run_dir / "draft.json"
    research_json = Path(args.research_json) if args.research_json else run_dir / "research.json"
    image_json = Path(args.image_json) if args.image_json else run_dir / "image.json"

    results: dict[str, Any] = {}
    gate_paths: list[Path] = []

    if research_json.exists():
        result = maybe_run("research_grounding_precheck.py", ["--research", str(research_json)], True)
        if result:
            path = run_dir / "preflight.research_grounding.json"
            path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
            results["research_grounding"] = result
            gate_paths.append(path)

    result = maybe_run(
        "topic_alignment_precheck.py",
        ["--draft", str(draft_json), "--approved-topic", args.approved_topic],
        draft_json.exists() and bool(args.approved_topic.strip()),
    )
    if result:
        path = run_dir / "preflight.topic_alignment.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        results["topic_alignment"] = result
        gate_paths.append(path)

    result = maybe_run("explainer_precheck.py", ["--draft", str(draft_json)], draft_json.exists())
    if result:
        path = run_dir / "preflight.explainer_quality.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        results["explainer_quality"] = result
        gate_paths.append(path)

    result = maybe_run("reader_experience_precheck.py", ["--draft", str(draft_json)], draft_json.exists())
    if result:
        path = run_dir / "preflight.reader_experience.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        results["reader_experience"] = result
        gate_paths.append(path)

    result = maybe_run(
        "visual_preflight.py",
        ["--image", str(image_json), "--draft", str(draft_json)],
        draft_json.exists() and image_json.exists(),
    )
    if result:
        path = run_dir / "preflight.visual_quality.json"
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        results["visual_quality"] = result
        gate_paths.append(path)

    if gate_paths:
        merged = run_json_command(
            [sys.executable, str(ROOT / "publish_ready_preflight.py"), *sum([["--gate-result", str(path)] for path in gate_paths], [])]
        )
    else:
        merged = {
            "ok": False,
            "gate": "publish_ready",
            "status": "fail",
            "failed_gates": [],
            "warnings": ["no_gate_results"],
            "owner_routing": [],
            "next_action_hint": "No preflight inputs were available.",
            "artifacts_used": [],
            "summary": "no gate results available",
        }

    merged_path = run_dir / "preflight.publish_ready.json"
    merged_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2))
    results["publish_ready"] = merged

    payload = {
      "ok": merged["ok"],
      "run_dir": str(run_dir),
      "results": results,
      "merged_path": str(merged_path),
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
