#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from uuid import uuid4


SIDE_CAR = "/Users/daehan/ec2-migration/home-ubuntu/board-app/scripts/grok-web-sidecar.js"


def build_prompt(mode: str, topic: str, draft_title: str | None) -> tuple[str, str]:
    marker = f"GROK_JSON_{uuid4().hex[:12]}"
    if mode == "trend-scan":
      payload_instruction = """
Return a JSON object with:
- public_narratives: array of 3 short strings
- counter_angles: array of 3 short strings
- title_hooks: array of 5 short strings
- why_now: short string
- confidence: low|medium|high
""".strip()
    elif mode == "title-hook":
      payload_instruction = """
Return a JSON object with:
- title_variants: array of 5 short strings
- opening_hook_variants: array of 3 short strings
- click_risk_warnings: array of short strings
- confidence: low|medium|high
""".strip()
    else:
      raise SystemExit(f"unsupported mode: {mode}")

    prompt = f"""You are helping a media operation choose framing for a public article.

Topic: {topic}
Draft title: {draft_title or ''}

{payload_instruction}

Return ONLY the JSON object wrapped exactly like this:
<{marker}>
{{...}}
</{marker}>
"""
    return prompt, marker


def extract_marked_json(text: str, marker: str) -> dict:
    start_token = f"<{marker}>"
    end_token = f"</{marker}>"
    start = text.rfind(start_token)
    end = text.rfind(end_token)
    if start == -1 or end == -1 or end <= start:
        raise ValueError("marker_block_missing")
    body = text[start + len(start_token):end].strip()
    return json.loads(body)


def run_sidecar(prompt: str, raw_out: Path, timeout_ms: int) -> dict:
    cmd = ["node", SIDE_CAR, "--prompt", prompt, "--output", str(raw_out), "--timeout", str(timeout_ms)]
    raw = subprocess.check_output(cmd, text=True)
    return json.loads(raw)


def main() -> int:
    parser = argparse.ArgumentParser(description="Use Grok web sidecar and save a cleaned JSON artifact.")
    parser.add_argument("--mode", choices=["trend-scan", "title-hook"], required=True)
    parser.add_argument("--topic", required=True)
    parser.add_argument("--draft-title")
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout-ms", type=int, default=45000)
    args = parser.parse_args()

    out_path = Path(args.out)
    raw_path = out_path.with_suffix(".raw.json")

    prompt, marker = build_prompt(args.mode, args.topic, args.draft_title)
    sidecar = run_sidecar(prompt, raw_path, args.timeout_ms)
    payload = extract_marked_json(sidecar.get("responseText", ""), marker)

    result = {
        "ok": True,
        "source": "grok-web-artifact-step",
        "mode": args.mode,
        "topic": args.topic,
        "draft_title": args.draft_title or None,
        "payload": payload,
        "capturedAt": sidecar.get("capturedAt"),
        "pageUrl": sidecar.get("pageUrl"),
        "title": sidecar.get("title"),
        "rawArtifactPath": str(raw_path),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
