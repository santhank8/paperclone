# 计费账本与报告

## 背景

Paperclip 目前将模型费用存储在 `cost_events` 中，将运行操作状态存储在 `heartbeat_runs` 中。
这种拆分本身没有问题，但当前的报告代码试图通过混合使用这两张表来推断计费语义：

- `cost_events` 包含提供商、模型、token 数量和金额信息
- `heartbeat_runs.usage_json` 包含部分每次运行的计费元数据
- `heartbeat_runs.usage_json` 目前**不**包含足够规范化的计费维度，无法支持准确的提供商级报告

一旦某家公司使用了多个提供商、多个计费渠道或多种计费模式，现有系统就会出现错误。

示例：

- 直接使用 OpenAI API
- Claude 订阅用量，边际费用为零
- 订阅超额使用，含金额和 token
- OpenRouter 计费，其中计费方为 OpenRouter，但上游提供商是 Anthropic 或 OpenAI

系统需要支持：

- 金额报告
- token 报告
- 订阅内含用量
- 订阅超额用量
- 直接计量 API 用量
- 未来的聚合商计费（如 OpenRouter）

## 产品决策

`cost_events` 成为报告所用的权威计费与用量账本。

`heartbeat_runs` 保持为运行操作日志。它可以保留镜像的计费元数据用于调试和记录，但报告不得从 `heartbeat_runs.usage_json` 中重建计费语义。

## 决策：单一账本还是两张表

解决当前 PR 的问题**不需要**两张表。
对于请求级推理报告，只要 `cost_events` 携带了正确的维度即可满足需求：

- 上游提供商
- 计费方
- 计费类型
- 模型
- token 字段
- 计费金额

这就是为什么第一阶段实现选择扩展 `cost_events`，而不是立即引入第二张表。

但是，如果 Paperclip 需要覆盖聚合商和托管 AI 平台的完整计费面，则 `cost_events` 单独是不够的。
某些费用无法简洁地表示为单次模型推理事件：

- 账户充值和积分购买
- 购买时收取的平台费用
- 账户级或基于阈值的 BYOK 平台费用
- 预付积分到期、退款和调整
- 预留吞吐量承诺
- 微调、训练、模型导入和存储费用
- 网关日志记录或其他无法归因于单次提示/响应对的平台开销

因此，决策如下：

- 近期：保留 `cost_events` 作为推理和用量账本
- 下一阶段：添加 `finance_events` 用于非推理类财务事件

这是有意为之的拆分，区分了：

- 用量与推理会计
- 账户级和平台级财务会计

这种分离确保请求报告的准确性，避免将从未属于请求范围的行强行套入发票语义。

## External Motivation And Sources

The need for this model is not theoretical.
It follows directly from the billing systems of providers and aggregators Paperclip needs to support.

### OpenRouter

Source URLs:

- https://openrouter.ai/docs/faq#credit-and-billing-systems
- https://openrouter.ai/pricing

Relevant billing behavior as of March 14, 2026:

- OpenRouter passes through underlying inference pricing and deducts request cost from purchased credits.
- OpenRouter charges a 5.5% fee with a $0.80 minimum when purchasing credits.
- Crypto payments are charged a 5% fee.
- BYOK has its own fee model after a free request threshold.
- OpenRouter billing is aggregated at the OpenRouter account level even when the upstream provider is Anthropic, OpenAI, Google, or another provider.

Implication for Paperclip:

- request usage belongs in `cost_events`
- credit purchases, purchase fees, BYOK fees, refunds, and expirations belong in `finance_events`
- `biller=openrouter` must remain distinct from `provider=anthropic|openai|google|...`

### Cloudflare AI Gateway Unified Billing

Source URL:

- https://developers.cloudflare.com/ai-gateway/features/unified-billing/

Relevant billing behavior as of March 14, 2026:

- Unified Billing lets users call multiple upstream providers while receiving a single Cloudflare bill.
- Usage is paid from Cloudflare-loaded credits.
- Cloudflare supports manual top-ups and auto top-up thresholds.
- Spend limits can stop request processing on daily, weekly, or monthly boundaries.
- Unified Billing traffic can use Cloudflare-managed credentials rather than the user's direct provider key.

Implication for Paperclip:

- request usage needs `biller=cloudflare`
- upstream provider still needs to be preserved separately
- Cloudflare credit loads and related account-level events are not inference rows and should not be forced into `cost_events`
- quota and limits reporting must support biller-level controls, not just upstream provider limits

### Amazon Bedrock

Source URL:

- https://aws.amazon.com/bedrock/pricing/

Relevant billing behavior as of March 14, 2026:

- Bedrock supports on-demand and batch pricing.
- Bedrock pricing varies by region.
- some pricing tiers add premiums or discounts relative to standard pricing
- provisioned throughput is commitment-based rather than request-based
- custom model import uses Custom Model Units billed per minute, with monthly storage charges
- imported model copies are billed in 5-minute windows once active
- customization and fine-tuning introduce training and hosted-model charges beyond normal inference

Implication for Paperclip:

- normal tokenized inference fits in `cost_events`
- provisioned throughput, custom model unit charges, training, and storage charges require `finance_events`
- region and pricing tier need to be first-class dimensions in the financial model

## Ledger Boundary

To keep the system coherent, the table boundary should be explicit.

### `cost_events`

Use `cost_events` for request-scoped usage and inference charges:

- one row per billable or usage-bearing run event
- provider/model/biller/billingType/tokens/cost
- optionally tied to `heartbeat_run_id`
- supports direct APIs, subscriptions, overage, OpenRouter-routed inference, Cloudflare-routed inference, and Bedrock on-demand inference

### `finance_events`

Use `finance_events` for account-scoped or platform-scoped financial events:

- credit purchase
- top-up
- refund
- fee
- expiry
- provisioned capacity
- training
- model import
- storage
- invoice adjustment

These rows may or may not have a related model, provider, or run id.
Trying to force them into `cost_events` would either create fake request rows or create null-heavy rows that mean something fundamentally different from inference usage.

## Canonical Billing Dimensions

Every persisted billing event should model four separate axes:

1. Usage provider
   The upstream provider whose model performed the work.
   Examples: `openai`, `anthropic`, `google`.

2. Biller
   The system that charged for the usage.
   Examples: `openai`, `anthropic`, `openrouter`, `cursor`, `chatgpt`.

3. Billing type
   The pricing mode applied to the event.
   Initial canonical values:
   - `metered_api`
   - `subscription_included`
   - `subscription_overage`
   - `credits`
   - `fixed`
   - `unknown`

4. Measures
   Usage and billing must both be storable:
   - `input_tokens`
   - `output_tokens`
   - `cached_input_tokens`
   - `cost_cents`

These dimensions are independent.
For example, an event may be:

- provider: `anthropic`
- biller: `openrouter`
- billing type: `metered_api`
- tokens: non-zero
- cost cents: non-zero

Or:

- provider: `anthropic`
- biller: `anthropic`
- billing type: `subscription_included`
- tokens: non-zero
- cost cents: `0`

## Schema Changes

Extend `cost_events` with:

- `heartbeat_run_id uuid null references heartbeat_runs.id`
- `biller text not null default 'unknown'`
- `billing_type text not null default 'unknown'`
- `cached_input_tokens int not null default 0`

Keep `provider` as the upstream usage provider.
Do not overload `provider` to mean biller.

Add a future `finance_events` table for account-level financial events with fields along these lines:

- `company_id`
- `occurred_at`
- `event_kind`
- `direction`
- `biller`
- `provider nullable`
- `execution_adapter_type nullable`
- `pricing_tier nullable`
- `region nullable`
- `model nullable`
- `quantity nullable`
- `unit nullable`
- `amount_cents`
- `currency`
- `estimated`
- `related_cost_event_id nullable`
- `related_heartbeat_run_id nullable`
- `external_invoice_id nullable`
- `metadata_json nullable`

Add indexes:

- `(company_id, biller, occurred_at)`
- `(company_id, provider, occurred_at)`
- `(company_id, heartbeat_run_id)` if distinct-run reporting remains common

## Shared Contract Changes

### Shared types

Add a shared billing type union and enrich cost types with:

- `heartbeatRunId`
- `biller`
- `billingType`
- `cachedInputTokens`

Update reporting response types so the provider breakdown reflects the ledger directly rather than inferred run metadata.

### Validators

Extend `createCostEventSchema` to accept:

- `heartbeatRunId`
- `biller`
- `billingType`
- `cachedInputTokens`

Defaults:

- `biller` defaults to `provider`
- `billingType` defaults to `unknown`
- `cachedInputTokens` defaults to `0`

## Adapter Contract Changes

Extend adapter execution results so they can report:

- `biller`
- richer billing type values

Backwards compatibility:

- existing adapter values `api` and `subscription` are treated as legacy aliases
- map `api -> metered_api`
- map `subscription -> subscription_included`

Future adapters may emit the canonical values directly.

OpenRouter support will use:

- `provider` = upstream provider when known
- `biller` = `openrouter`
- `billingType` = `metered_api` unless OpenRouter later exposes another billing mode

Cloudflare Unified Billing support will use:

- `provider` = upstream provider when known
- `biller` = `cloudflare`
- `billingType` = `credits` or `metered_api` depending on the normalized request billing contract

Bedrock support will use:

- `provider` = upstream provider or `aws_bedrock` depending on adapter shape
- `biller` = `aws_bedrock`
- `billingType` = request-scoped mode for inference rows
- `finance_events` for provisioned, training, import, and storage charges

## Write Path Changes

### Heartbeat-created events

When a heartbeat run produces usage or spend:

1. normalize adapter billing metadata
2. write a ledger row to `cost_events`
3. attach `heartbeat_run_id`
4. set `provider`, `biller`, `billing_type`, token fields, and `cost_cents`

The write path should no longer depend on later inference from `heartbeat_runs`.

### Manual API-created events

Manual cost event creation remains supported.
These events may have `heartbeatRunId = null`.

Rules:

- `provider` remains required
- `biller` defaults to `provider`
- `billingType` defaults to `unknown`

## Reporting Changes

### Server

Refactor reporting queries to use `cost_events` only.

#### `summary`

- sum `cost_cents`

#### `by-agent`

- sum costs and token fields from `cost_events`
- use `count(distinct heartbeat_run_id)` filtered by billing type for run counts
- use token sums filtered by billing type for subscription usage

#### `by-provider`

- group by `provider`, `model`
- sum costs and token fields directly from the ledger
- derive billing-type slices from `cost_events.billing_type`
- never pro-rate from unrelated `heartbeat_runs`

#### future `by-biller`

- group by `biller`
- this is the right view for invoice and subscription accountability

#### `window-spend`

- continue to use `cost_events`

#### project attribution

Keep current project attribution logic for now, but prefer `cost_events.heartbeat_run_id` as the join anchor whenever possible.

## UI Changes

### Principles

- Spend, usage, and quota are related but distinct
- a missing quota fetch is not the same as “no quota”
- provider and biller are different dimensions

### Immediate UI changes

1. Keep the current costs page structure.
2. Make the provider cards accurate by reading only ledger-backed values.
3. Show provider quota fetch errors explicitly instead of dropping them.

### Follow-up UI direction

The long-term board UI should expose:

- Spend
  Dollars by biller, provider, model, agent, project
- Usage
  Tokens by provider, model, agent, project
- Quotas
  Live provider or biller limits, credits, and reset windows
- Financial events
  Credit purchases, top-ups, fees, refunds, commitments, storage, and other non-inference charges

## Migration Plan

Migration behavior:

- add new non-destructive columns with defaults
- backfill existing rows:
  - `biller = provider`
  - `billing_type = 'unknown'`
  - `cached_input_tokens = 0`
  - `heartbeat_run_id = null`

Do **not** attempt to backfill historical provider-level subscription attribution from `heartbeat_runs`.
That data was never stored with the required dimensions.

## Testing Plan

Add or update tests for:

1. heartbeat-created ledger rows persist `heartbeatRunId`, `biller`, `billingType`, and cached tokens
2. legacy adapter billing values map correctly
3. provider reporting uses ledger data only
4. mixed-provider companies do not cross-attribute subscription usage
5. zero-dollar subscription usage still appears in token reporting
6. quota fetch failures render explicit UI state
7. manual cost events still validate and write correctly
8. biller reporting keeps upstream provider breakdowns separate
9. OpenRouter-style rows can show `biller=openrouter` with non-OpenRouter upstream providers
10. Cloudflare-style rows can show `biller=cloudflare` with preserved upstream provider identity
11. future `finance_events` aggregation handles non-request charges without requiring a model or run id

## Delivery Plan

### Step 1

- land the ledger contract and query rewrite
- make the current costs page correct

### Step 2

- add biller-oriented reporting endpoints and UI

### Step 3

- wire OpenRouter and any future aggregator adapters to the same contract

### Step 4

- add `executionAdapterType` to persisted cost reporting if adapter-level grouping becomes a product requirement

### Step 5

- introduce `finance_events`
- add non-inference accounting endpoints
- add UI for platform/account charges alongside inference spend and usage

## Non-Goals For This Change

- multi-currency support
- invoice reconciliation
- provider-specific cost estimation beyond persisted billed cost
- replacing `heartbeat_runs` as the operational run record
