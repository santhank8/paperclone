# Security Policy

## Internal Infrastructure

This is **ValCtrl internal infrastructure** (`valctrl-paperclip`), an internal fork of [Paperclip](https://github.com/paperclipai/paperclip) used as our agent orchestration dashboard.

This instance is **not intended for public deployment**. It runs on our private EC2 infrastructure ("shambala") managing OpenClaw agents.

## Hardened Defaults

- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true` — no open registration
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated` — requires login
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` — not exposed to public internet

## Reporting Vulnerabilities

If you discover a security issue in this fork:

1. **Do NOT open a public issue**
2. Contact the team directly via internal channels
3. For issues in upstream Paperclip, report to the [upstream repository](https://github.com/paperclipai/paperclip)

## What Was Removed

No telemetry, analytics, or phone-home code was found in the upstream codebase. See `FORK.md` for the full audit results.
