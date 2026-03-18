"""CLI: crca-q run --json"""

from __future__ import annotations

import argparse
import json
import os
import sys

from crca_q.agent import run_cycle_sync
from crca_q.execution.mode import ExecutionMode
from crca_q.paperclip_bridge import post_run_comment
from crca_q.schemas import RunInput


def main() -> None:
    parser = argparse.ArgumentParser(prog="crca-q")
    sub = parser.add_subparsers(dest="cmd", required=True)
    run_p = sub.add_parser("run", help="Single quant cycle; JSON to stdout")
    run_p.add_argument("--json", action="store_true", help="Print RunOutput as JSON")
    run_p.add_argument(
        "--execution-mode",
        choices=["disabled", "paper", "live"],
        default=None,
        help="Override CRCA_Q_EXECUTION_MODE",
    )
    args = parser.parse_args()
    if args.cmd != "run":
        parser.print_help()
        sys.exit(2)

    raw = os.environ.get("PAPERCLIP_CONTEXT_JSON", "").strip()
    ctx: dict = {}
    if raw:
        try:
            ctx = json.loads(raw)
        except json.JSONDecodeError as e:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": f"invalid PAPERCLIP_CONTEXT_JSON: {e}",
                        "execution_mode": "disabled",
                    }
                ),
                file=sys.stdout,
            )
            sys.exit(1)

    inp = RunInput.from_context_dict(ctx)
    mode = ExecutionMode(args.execution_mode) if args.execution_mode else None
    out = run_cycle_sync(inp, execution_mode=mode)

    jwt = os.environ.get("PAPERCLIP_AGENT_JWT", "").strip()
    api = os.environ.get("PAPERCLIP_API_URL", "").strip()
    if inp.issue_id and jwt and api:
        try:
            out.comment_posted = post_run_comment(api, jwt, inp.issue_id, out)
        except Exception:
            out.comment_posted = False

    print(json.dumps(out.model_dump(), indent=2), file=sys.stdout)
    sys.exit(0 if out.ok else 1)


if __name__ == "__main__":
    main()
