"""POST run summary to Paperclip as an issue comment (agent JWT)."""

from __future__ import annotations

import json

import httpx

from crca_q.schemas import RunOutput


def post_run_comment(
    api_base: str,
    jwt: str,
    issue_id: str,
    output: RunOutput,
    timeout_sec: float = 60.0,
) -> bool:
    base = api_base.rstrip("/")
    url = f"{base}/api/issues/{issue_id}/comments"
    body_text = _format_comment(output)
    with httpx.Client(timeout=timeout_sec) as client:
        r = client.post(
            url,
            headers={
                "Authorization": f"Bearer {jwt}",
                "Content-Type": "application/json",
            },
            json={"body": body_text},
        )
        return r.is_success


def _format_comment(output: RunOutput) -> str:
    lines = [
        "## CRCA-Q run",
        "",
        f"- ok: {output.ok}",
        f"- execution_mode: {output.execution_mode}",
        f"- heartbeat_run_id: {output.heartbeat_run_id or '—'}",
    ]
    if output.error:
        lines.append(f"- error: `{output.error[:2000]}`")
    if output.decisions:
        lines.append("")
        lines.append("### Decisions")
        for d in output.decisions[:50]:
            lines.append(
                f"- **{d.symbol}**: {d.signal} (conf={d.confidence:.2f})"
                + (f" causal={d.causal_score}" if d.causal_score is not None else "")
            )
    lines.append("")
    lines.append("<details><summary>JSON</summary>")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(output.model_dump(), indent=2)[:12000])
    lines.append("```")
    lines.append("</details>")
    return "\n".join(lines)[:50000]
