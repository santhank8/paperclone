# Grok Sidecar Artifact Steps

## Purpose

Use the logged-in `openchrome-grok` session as a sidecar for:

- public narrative scan
- title and hook challenge
- counter-angle discovery

Do not use it as canonical grounding.

## Current operational path

- browser session: `openchrome-grok`
- CDP URL: `http://127.0.0.1:18910`
- sidecar script:
  - `/Users/daehan/ec2-migration/home-ubuntu/board-app/scripts/grok-web-sidecar.js`
- system-tools entry:
  - `queryGrokWeb(prompt, options)`

## Research Lead artifact step

Use after RSS shortlist and before NotebookLM grounding:

- output file example: `grok-trend-scan.json`
- purpose:
  - what people may care about
  - what counter-angle may exist
  - what framing may overpromise

## Growth Lead artifact step

Use after draft title or article hook exists:

- output file example: `grok-title-hook-scan.json`
- purpose:
  - alternative title hooks
  - click-risk warnings
  - public-narrative framing check

## Rule

Grok sidecar is a `market/public-narrative layer`.

NotebookLM remains the `canonical grounding layer`.
