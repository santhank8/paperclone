# crca_q

Paperclip-integrated runner for the legacy quant stack in `CR-CA/branches/CRCA-Q.py`.

## Install

```bash
cd Intellitrade-CRCA/crca_q
pip install -e .
```

Full signal pipeline requires CR-CA dependencies (`pip install -r ../CR-CA/requirements.txt`).

## Usage

Process agent:

- `command`: `crca-q`
- `args`: `["run", "--json"]`
- `cwd`: `Intellitrade-CRCA` (so `CR-CA/` resolves)

Env (injected by Paperclip on heartbeat):

- `PAPERCLIP_CONTEXT_JSON` — run context
- `PAPERCLIP_AGENT_JWT` — optional; used to post summary comment
- `PAPERCLIP_API_URL` — API base

Optional:

- `CRCA_Q_EXECUTION_MODE` — `disabled` (default) | `paper` | `live`

See [docs/integrations/paperclip.md](../docs/integrations/paperclip.md).
