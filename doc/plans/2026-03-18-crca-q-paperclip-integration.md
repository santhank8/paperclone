# CRCA-Q + Paperclip integration (landed)

Date: 2026-03-18

## Code

- **Python package:** [Intellitrade-CRCA/crca_q/](Intellitrade-CRCA/crca_q/) — `crca-q run --json`, `RunInput`/`RunOutput`, legacy delegate to `CR-CA/branches/CRCA-Q.py`.
- **Paperclip process adapter:** Injects `PAPERCLIP_CONTEXT_JSON` and `PAPERCLIP_AGENT_JWT`; process adapter enables `supportsLocalAgentJwt` ([server/src/adapters/process/execute.ts](server/src/adapters/process/execute.ts)).
- **Log redaction:** `PAPERCLIP_AGENT_JWT` redacted via `jwt` in sensitive env key regex ([packages/adapter-utils/src/server-utils.ts](packages/adapter-utils/src/server-utils.ts)).
- **Docs:** [Intellitrade-CRCA/docs/integrations/paperclip.md](Intellitrade-CRCA/docs/integrations/paperclip.md).
- **Optional entry:** [Intellitrade-CRCA/CR-CA/branches/paperclip_crca_entry.py](Intellitrade-CRCA/CR-CA/branches/paperclip_crca_entry.py) (requires `cd crca_q && pip install -e .` from Intellitrade-CRCA).

## Verification

- Python: `cd Intellitrade-CRCA/crca_q && pip install -e ".[dev]" && pytest tests/`
- Server: `pnpm test:run server/src/__tests__/process-adapter-paperclip-context.test.ts` (after `pnpm install`)
