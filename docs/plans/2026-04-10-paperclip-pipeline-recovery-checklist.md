# Paperclip Pipeline Recovery Checklist

## Current State

- `draft -> image -> draft_review -> draft_polish -> final_review -> validate -> publish -> public_verify` 경로를 실운영 기준으로 재검증했다.
- live publish / live public verify / cleanup(trash)까지 실제 WordPress에서 확인했다.
- 마지막 실검증 run:
  - `blog_run_id`: `5b98b4a5-40e9-4120-8e37-cddba75a889e`
  - `wordpress_post_id`: `1102`
  - `verify_status`: `public_verified`
  - `cleanup_status`: `trash`

## Recovery Scope

### 1. Draft Contract Recovery
- `structured_draft_missing` 복구
- draft step 결과가 `article_html`을 실제 payload / `draft.json` / `contextJson`에 모두 남기도록 수정
- artifact mirror가 metadata-only payload로 structured draft를 덮어쓰지 않도록 수정

### 2. Read-Through Recovery
- opening grip / paragraph tension / section progression / save worthiness 계약 추가
- reader blocks, TOC, decision box, source links, checklist를 validator 친화적 형태로 정리
- opening filler 제거, concrete example 보강, plain-language bridge 보강

### 3. Validator Compatibility
- `draft.json`을 structured validator 스키마에 맞게 alias/compat 필드 추가
- `persona_id`, `branch_scores`, `reader_blocks`, `claim_ledger`, `verification_layer`, `image_policy`, `render_assembly` 정합화

### 4. Publish / Public Verify Recovery
- publish step 결과가 `contextJson`에 merge되어 publish 단계가 실제 본문을 사용하도록 수정
- public verify가 publish credential (`PUBLISH_WP_*`)을 우선 사용하도록 수정
- live URL 검증 시 `publish.url` / `post.link` 중 실제로 열리는 URL을 선택하도록 수정
- redirect false fail과 archive/home entrypoint false fail 완화

## Smoke Commands

### App Server
```bash
cd /Users/daehan/Documents/persona/paperclip
corepack pnpm dev:list
```

### Live Verify Helper
```bash
cd /Users/daehan/Documents/persona/paperclip
corepack pnpm tsx scripts/run_live_publish_verify.ts <BLOG_RUN_ID>
```

### Focused Regression
```bash
node /Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-draft-readthrough-regression.js
node /Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-draft-positive-bias.js
node /Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-public-verify-readthrough.js
cd /Users/daehan/Documents/persona/paperclip
corepack pnpm vitest run server/src/__tests__/blog-run-worker.test.ts server/src/__tests__/public-verify-config.test.ts
```

## Watch Items

### 1. Embedded Postgres Test Collisions
- 일부 `vitest` suite가 embedded postgres 재사용 충돌로 실패할 수 있다.
- 증상:
  - `relation "blog_artifacts" already exists`
- 코드 회귀가 아니라 test infra 충돌일 수 있으므로, run-level evidence를 함께 본다.

### 2. Dry-Run / Publish Mode Mixing
- `publishMode=dry_run` run도 과거에 `publishedUrl` / `wordpressPostId`를 가진 기록이 있다.
- 운영 판단 시:
  - `run.status`
  - `publishMode`
  - `blog_publish_executions`
  - 실제 `verify.json`
  를 같이 본다.

### 3. Public Verify Drift
- 현재 false fail은 대부분 정리됐지만, WordPress theme/plugin이 본문을 강하게 바꾸면 다시 drift가 날 수 있다.
- 재발 시 먼저 볼 것:
  - `verify.json`
  - `publish.json`
  - `blog_publish_executions.result_json.link`
  - 실제 public HTML readback

## Commit-Ready Change Groups

### Group A — Draft/Validator Recovery
- `/Users/daehan/.openclaw/workspace/mac-pipeline/lib/draft/run-draft-step.js`
- `/Users/daehan/.openclaw/workspace/mac-pipeline/lib/draft/run-draft-polish-step.js`
- `/Users/daehan/.openclaw/workspace/mac-pipeline/lib/validate/run-validate-step.js`
- `/Users/daehan/ec2-migration/home-ubuntu/board-app/lib/publish-v3-renderer.js`
- related tests:
  - `/Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-draft-readthrough-regression.js`
  - `/Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-draft-positive-bias.js`
  - `/Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-readthrough-gates.js`

### Group B — Paperclip State Propagation
- `/Users/daehan/Documents/persona/paperclip/server/src/services/blog-artifact-mirror.ts`
- `/Users/daehan/Documents/persona/paperclip/server/src/services/blog-runs.ts`
- related tests:
  - `/Users/daehan/Documents/persona/paperclip/server/src/__tests__/blog-runs-service.test.ts`
  - `/Users/daehan/Documents/persona/paperclip/server/src/__tests__/blog-run-worker.test.ts`

### Group C — Public Verify / Live Ops
- `/Users/daehan/.openclaw/workspace/mac-pipeline/lib/verify/run-public-verify-step.js`
- `/Users/daehan/Documents/persona/paperclip/packages/blog-pipeline-core/src/adapters/public-verify.ts`
- `/Users/daehan/Documents/persona/paperclip/scripts/run_live_publish_verify.ts`
- related tests:
  - `/Users/daehan/Documents/persona/paperclip/server/src/__tests__/public-verify-config.test.ts`
  - `/Users/daehan/.openclaw/workspace/mac-pipeline/scripts/test-public-verify-readthrough.js`

## Exit Criteria

- `run_live_publish_verify.ts` 결과가 아래를 모두 만족하면 운영 복구로 본다.
  - `publishStep.status = published`
  - `verifyStep.status = public_verified`
  - `finalRun.status = public_verified`
  - `quarantine.receipt.finalStatus = trash`
