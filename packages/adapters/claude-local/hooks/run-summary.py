#!/usr/bin/env python3
"""Stop hook: summarize agent work and post to Paperclip issue.

Runs after a Claude agent session finishes. Reads the transcript,
checks git state, calls Sonnet to summarize, and posts a structured
comment on the triggering Paperclip issue.

Only active when PAPERCLIP_TASK_ID is set (i.e., triggered by a
Paperclip heartbeat). Silently exits otherwise.

Env vars (injected by claude_local adapter):
  PAPERCLIP_TASK_ID   — issue UUID to comment on
  PAPERCLIP_API_KEY   — bearer token
  PAPERCLIP_API_URL   — e.g. http://localhost:3100
  PAPERCLIP_RUN_ID    — current run UUID
  PAPERCLIP_AGENT_ID  — agent UUID
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

TASK_ID = os.environ.get("PAPERCLIP_TASK_ID", "")
API_KEY = os.environ.get("PAPERCLIP_API_KEY", "")
API_URL = os.environ.get("PAPERCLIP_API_URL", "").rstrip("/")
RUN_ID = os.environ.get("PAPERCLIP_RUN_ID", "")
AGENT_ID = os.environ.get("PAPERCLIP_AGENT_ID", "")


def extract_assistant_text(transcript_path: str) -> list[str]:
    """Extract assistant text blocks from a JSONL transcript."""
    parts: list[str] = []
    try:
        with open(transcript_path) as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = entry.get("message", {})
                if msg.get("role") != "assistant":
                    continue
                content = msg.get("content", "")
                if isinstance(content, str) and content.strip():
                    parts.append(content.strip())
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text = block.get("text", "").strip()
                            if text:
                                parts.append(text)
    except Exception:
        pass
    return parts


def git_cmd(*args: str) -> str | None:
    """Run a git command, return stdout or None on failure."""
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def get_git_info() -> dict[str, str]:
    """Collect git state: commits, branch, diff, uncommitted changes."""
    info: dict[str, str] = {}

    branch = git_cmd("branch", "--show-current")
    if branch:
        info["branch"] = branch

    # Recent commits made during this session (last 10)
    commits = git_cmd("log", "--oneline", "-10", "--no-decorate")
    if commits:
        info["commits"] = commits

    # Diff stat of most recent commit
    diff_stat = git_cmd("diff", "--stat", "HEAD~1", "HEAD")
    if diff_stat:
        info["diff_stat"] = diff_stat

    # Actual diff content (capped at 4000 chars for Sonnet context)
    diff_content = git_cmd("diff", "HEAD~1", "HEAD")
    if diff_content:
        info["diff"] = diff_content[:4000]

    # Uncommitted changes
    uncommitted = git_cmd("status", "--porcelain")
    if uncommitted:
        info["uncommitted"] = uncommitted

    # Unpushed commits
    unpushed = git_cmd("log", "--oneline", "@{upstream}..HEAD")
    if unpushed:
        info["unpushed"] = unpushed

    # Open PRs from current branch
    if branch:
        pr_info = git_cmd("log", "--oneline", "-1", "--format=%s")
        # Check for PR URL in recent output (gh pr create outputs it)
        info["head_commit_msg"] = pr_info or ""

    return info


def call_sonnet(context: str, git_info: dict[str, str]) -> str | None:
    """Call Sonnet to generate a clean issue comment."""
    has_commits = bool(git_info.get("commits"))
    has_diff = bool(git_info.get("diff") or git_info.get("diff_stat"))

    git_section = ""
    if git_info.get("branch"):
        git_section += f"Branch: {git_info['branch']}\n"
    if git_info.get("commits"):
        git_section += f"\nRecent commits:\n{git_info['commits']}\n"
    if git_info.get("diff_stat"):
        git_section += f"\nFiles changed (last commit):\n{git_info['diff_stat']}\n"
    if git_info.get("diff"):
        git_section += f"\nDiff (last commit, truncated):\n{git_info['diff']}\n"
    if git_info.get("uncommitted"):
        git_section += f"\nUncommitted changes:\n{git_info['uncommitted']}\n"
    if git_info.get("unpushed"):
        git_section += f"\nUnpushed commits:\n{git_info['unpushed']}\n"

    prompt = (
        "You are summarizing what an AI coding agent did during a Paperclip work session. "
        "Write an issue comment in markdown. Adapt your format to match what was done.\n\n"
        "## Header\n\n"
        "Always start with one of:\n"
        "- `## Done` — work is complete\n"
        "- `## Blocked` — agent hit a blocker (explain what and who must act)\n"
        "- `## Update` — work is in progress but not finished\n\n"
        "Then a 1-2 sentence summary.\n\n"
        "## Adapt to the work type\n\n"
        "**If code was committed** (commits exist in git state):\n"
        "Include a `### Changes` section with:\n"
        "- **Commits**: `abc1234` — short description (list each)\n"
        "- **Files changed**: key files from the diff stat\n"
        "- **What changed**: brief description of the actual code changes based on the diff\n"
        "- **PR**: link if one was created\n"
        "- **Tests**: passed / added N / skipped (why)\n"
        "- **Deploy**: needed / not needed\n\n"
        "**If research, investigation, or information gathering** (no commits):\n"
        "Include a `### Findings` section with the actual results. "
        "This is the substantive output — include tables, lists, analysis, "
        "whatever the agent produced. Don't summarize into nothing. "
        "If the agent built a table, include the table. If it wrote analysis, "
        "include the key points. Multiple paragraphs are fine.\n\n"
        "**If planning or design work** (no commits, plan discussed):\n"
        "Include a `### Plan` section with the proposed approach.\n\n"
        "## Rules\n"
        "- Strip ALL internal process: skill evaluations, hook outputs, "
        "permission checks, tool call JSON, file-reading mechanics.\n"
        "- Focus on OUTCOMES and SUBSTANCE.\n"
        "- If there are uncommitted changes, flag as a warning.\n"
        "- If there are unpushed commits, note it.\n"
        "- DO NOT pad with boilerplate. No empty sections. "
        "Only include sections that have real content.\n\n"
    )

    if git_section:
        prompt += f"--- GIT STATE ---\n{git_section}--- END GIT ---\n\n"

    prompt += f"--- AGENT SESSION OUTPUT ---\n{context}\n--- END ---"

    try:
        result = subprocess.run(
            [
                "claude", "-p", prompt,
                "--model", "sonnet",
                "--output-format", "text",
                "--dangerously-skip-permissions",
                "--no-session-persistence",
            ],
            capture_output=True, text=True, timeout=60,
            cwd=os.environ.get("HOME", "/home/ubuntu"),
        )
        return result.stdout.strip() if result.stdout.strip() else None
    except Exception as e:
        sys.stderr.write(f"[run-summary] Sonnet call failed: {e}\n")
        return None


def determine_status(summary: str, git_info: dict[str, str]) -> str:
    """Infer issue status from the summary and git state."""
    lower = (summary or "").lower()
    first_line = lower.split("\n")[0] if lower else ""

    if "## blocked" in first_line or "blocked" in first_line:
        return "blocked"
    if "## done" in first_line or "done" in first_line:
        return "done"
    if "## update" in first_line or "update" in first_line:
        return "in_progress"
    # Default to done — the agent session completed, so assume work finished
    # unless the summary explicitly says blocked or update.
    return "done"


def build_fallback_comment(
    git_info: dict[str, str], assistant_parts: list[str],
) -> str:
    """Build a basic comment when Sonnet isn't available."""
    has_commits = bool(git_info.get("commits"))

    if has_commits:
        lines = ["## Done\n", "Agent session completed."]
        lines.append(f"\n### Changes\n- **Commits**:\n```\n{git_info['commits']}\n```")
        if git_info.get("diff_stat"):
            lines.append(f"- **Files changed**:\n```\n{git_info['diff_stat']}\n```")
    else:
        lines = ["## Done\n", "Agent session completed."]
        if assistant_parts:
            # Include the last chunk of assistant output as findings
            last_output = "\n\n".join(assistant_parts)[-3000:]
            lines.append(f"\n### Findings\n\n{last_output}")

    if git_info.get("uncommitted"):
        lines.append(f"\n**Warning**: Uncommitted changes remain:\n```\n{git_info['uncommitted']}\n```")

    return "\n".join(lines)


def post_to_paperclip(comment: str, status: str) -> bool:
    """PATCH the issue with a comment and status update."""
    url = f"{API_URL}/api/issues/{TASK_ID}"

    payload = json.dumps({
        "status": status,
        "comment": comment,
    }).encode()

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    if RUN_ID:
        headers["X-Paperclip-Run-Id"] = RUN_ID

    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"[run-summary] API error {e.code}: {e.read().decode()[:200]}\n")
        return False
    except Exception as e:
        sys.stderr.write(f"[run-summary] API request failed: {e}\n")
        return False


def main() -> None:
    # Gate: only run when triggered by a Paperclip heartbeat
    if not TASK_ID or not API_KEY or not API_URL:
        return

    # Read hook input from stdin
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        hook_input = {}

    transcript_path = hook_input.get("transcript_path", "")

    # Extract assistant output
    assistant_parts: list[str] = []
    if transcript_path and os.path.exists(transcript_path):
        assistant_parts = extract_assistant_text(transcript_path)

    # Get git state
    git_info = get_git_info()

    if not assistant_parts and not git_info:
        return  # Nothing to report

    # Build context for Sonnet (cap at 12000 chars — take from end for recency)
    full_output = "\n\n".join(assistant_parts)
    context = full_output[-12000:] if len(full_output) > 12000 else full_output

    # Generate summary via Sonnet
    summary = call_sonnet(context, git_info)

    if not summary:
        summary = build_fallback_comment(git_info, assistant_parts)

    # Determine status
    status = determine_status(summary, git_info)

    # Post to Paperclip
    ok = post_to_paperclip(summary, status)
    if ok:
        sys.stderr.write(f"[run-summary] Posted {status} comment on {TASK_ID}\n")
    else:
        sys.stderr.write(f"[run-summary] Failed to post comment on {TASK_ID}\n")


if __name__ == "__main__":
    main()
