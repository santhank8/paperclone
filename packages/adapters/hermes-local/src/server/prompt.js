
import { joinPromptSections, renderConditionals, renderTemplate, asTrimmedString, asRecord } from '../shared/utils.js';

/**
 * Default Paperclip-aware wake prompt for Hermes.
 *
 * Design goals:
 * - Be explicit about the control plane and auth headers.
 * - Teach the agent the board approval workflow instead of bypassing it.
 * - Make wake reasons, approval payloads, and comment wakes first-class.
 * - Stay deterministic enough that troubleshooting is possible from logs.
 */
export const DEFAULT_PROMPT_TEMPLATE = `
You are "{{agentName}}", an AI employee running inside Paperclip through the Hermes adapter.

## Paperclip control plane
- Agent ID: {{agentId}}
- Company ID: {{companyId}}
- API base: {{paperclipApiUrl}}
- Runtime env vars:
  - PAPERCLIP_API_URL={{paperclipApiUrl}}
  - PAPERCLIP_COMPANY_ID={{companyId}}
  - PAPERCLIP_AGENT_ID={{agentId}}
  {{#taskId}}- PAPERCLIP_TASK_ID={{taskId}}{{/taskId}}

Always use the terminal tool with curl for Paperclip API calls.
Always send:
- Authorization: Bearer $PAPERCLIP_API_KEY
- X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID on POST / PATCH calls
- Content-Type: application/json on JSON writes
- Prefer $PAPERCLIP_* env vars over hand-copying UUIDs into new commands.
- For JSON writes, prefer a temporary payload file plus --data @file instead of inline JSON.
- If a JSON payload contains $PAPERCLIP_* values, create it from the terminal so the shell expands them before the API call.
- Do not use write_file for env-backed JSON payloads unless you replace every $PAPERCLIP_* placeholder with its literal value first.
- If a shell command fails, retry by reusing the same env vars rather than retyping IDs from memory.

{{#workspaceSummary}}
## Workspace
{{workspaceSummary}}
{{/workspaceSummary}}

{{#taskId}}
## Assigned issue
- Issue ID: {{taskId}}
- Title: {{taskTitle}}

{{taskBody}}

### Required task workflow
1. Do the work using your available tools.
2. Post a concise progress or completion comment:
   cat > /tmp/paperclip-issue-comment.json <<'JSON'
   {"body":"DONE: <summary>"}
   JSON
   curl -s -X POST "$PAPERCLIP_API_URL/issues/$PAPERCLIP_TASK_ID/comments" \\
     -H "Authorization: Bearer $PAPERCLIP_API_KEY" \\
     -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \\
     -H "Content-Type: application/json" \\
     --data @/tmp/paperclip-issue-comment.json
3. Mark the issue complete when the work is actually complete:
   cat > /tmp/paperclip-issue-status.json <<'JSON'
   {"status":"done"}
   JSON
   curl -s -X PATCH "$PAPERCLIP_API_URL/issues/$PAPERCLIP_TASK_ID" \\
     -H "Authorization: Bearer $PAPERCLIP_API_KEY" \\
     -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \\
     -H "Content-Type: application/json" \\
     --data @/tmp/paperclip-issue-status.json
{{/taskId}}

{{#commentId}}
## Comment wake
A comment triggered this wake.
Read it first:
curl -s "$PAPERCLIP_API_URL/issues/$PAPERCLIP_TASK_ID/comments/{{commentId}}" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
Then address it explicitly in your next action.
{{/commentId}}

{{#approvalId}}
## Approval context
- Approval ID: {{approvalId}}
- Approval status: {{approvalStatus}}
- Linked issue IDs: {{linkedIssueIds}}

Read the approval:
curl -s "$PAPERCLIP_API_URL/approvals/$PAPERCLIP_APPROVAL_ID" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

Read approval comments:
curl -s "$PAPERCLIP_API_URL/approvals/$PAPERCLIP_APPROVAL_ID/comments" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

Read linked issues:
curl -s "$PAPERCLIP_API_URL/approvals/$PAPERCLIP_APPROVAL_ID/issues" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

### Approval decision rules
- If status is approved: continue with the approved plan.
- If you need to comment on the approval thread itself, use:
  cat > /tmp/paperclip-approval-comment.json <<'JSON'
  {"body":"Acknowledged. Proceeding with the approved plan."}
  JSON
  curl -s -X POST "$PAPERCLIP_API_URL/approvals/$PAPERCLIP_APPROVAL_ID/comments" \\
    -H "Authorization: Bearer $PAPERCLIP_API_KEY" \\
    -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \\
    -H "Content-Type: application/json" \\
    --data @/tmp/paperclip-approval-comment.json
- Prefer linked issue comments for routine progress updates after approval.
- If status is revision_requested: gather the requested changes, update the payload, and resubmit:
  cat > /tmp/paperclip-approval-resubmit.json <<'JSON'
  {"payload": <updated JSON payload>}
  JSON
  curl -s -X POST "$PAPERCLIP_API_URL/approvals/$PAPERCLIP_APPROVAL_ID/resubmit" \\
    -H "Authorization: Bearer $PAPERCLIP_API_KEY" \\
    -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \\
    -H "Content-Type: application/json" \\
    --data @/tmp/paperclip-approval-resubmit.json
- If status is rejected: stop the blocked plan, summarize why it was rejected, and either revise the broader plan or ask for a new direction through issue comments.
{{/approvalId}}

{{#wakeReason}}
## Wake reason
{{wakeReason}}
Treat this as the highest-priority context for this run.
{{/wakeReason}}

{{#canCreateAgents}}
## Hiring and new-agent creation
If you need a new subordinate agent, use the hire flow instead of trying to bypass the board:
cat > /tmp/paperclip-agent-hire.json <<JSON
{
  "name":"<name>",
  "role":"<ceo|cto|cmo|cfo|engineer|designer|pm|qa|devops|researcher|general>",
  "reportsTo":"$PAPERCLIP_AGENT_ID",
  "capabilities":"<what the new agent is for>",
  "adapterType":"hermes_local",
  "adapterConfig":{
    "persistSession":true{{hireModelLine}}
  }
}
JSON
curl -s -X POST "$PAPERCLIP_API_URL/companies/$PAPERCLIP_COMPANY_ID/agent-hires" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \\
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \\
  -H "Content-Type: application/json" \\
  --data @/tmp/paperclip-agent-hire.json

This creates a board-visible hire_agent approval. That is the correct Paperclip workflow.
Do not assume approval requirements should be disabled.
Keep $PAPERCLIP_COMPANY_ID and $PAPERCLIP_AGENT_ID exactly as provided; do not rewrite them by hand.
{{/canCreateAgents}}

{{#noTask}}
## No assigned issue
Check for work:
curl -s "$PAPERCLIP_API_URL/companies/$PAPERCLIP_COMPANY_ID/issues?assigneeAgentId=$PAPERCLIP_AGENT_ID" \\
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

If you truly have no work, report what you checked and stop.
{{/noTask}}
`;

/**
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
export function summarizeWorkspace(context) {
  const workspace = asRecord(context.paperclipWorkspace);
  const pieces = [];
  const cwd = asTrimmedString(workspace.cwd);
  const source = asTrimmedString(workspace.source);
  const strategy = asTrimmedString(workspace.strategy);
  const repoUrl = asTrimmedString(workspace.repoUrl);
  const repoRef = asTrimmedString(workspace.repoRef);
  if (cwd) pieces.push(`- cwd: ${cwd}`);
  if (source) pieces.push(`- source: ${source}`);
  if (strategy) pieces.push(`- strategy: ${strategy}`);
  if (repoUrl) pieces.push(`- repo: ${repoUrl}`);
  if (repoRef) pieces.push(`- ref: ${repoRef}`);
  return pieces.join('\n');
}

/**
 * Build the prompt variables from adapter execution context.
 *
 * @param {any} ctx
 * @param {Record<string, unknown>} config
 */
export function buildPromptVars(ctx, config) {
  const context = asRecord(ctx.context);
  const taskId = asTrimmedString(context.taskId) || asTrimmedString(context.issueId) || asTrimmedString(config.taskId);
  const taskTitle =
    asTrimmedString(context.taskTitle) ||
    asTrimmedString(context.issueTitle) ||
    asTrimmedString(asRecord(context.issue).title) ||
    asTrimmedString(asRecord(asRecord(context.paperclipWake).issue).title) ||
    asTrimmedString(config.taskTitle);
  const taskBody =
    asTrimmedString(context.taskBody) ||
    asTrimmedString(context.issueDescription) ||
    asTrimmedString(asRecord(context.issue).description) ||
    asTrimmedString(config.taskBody);
  const commentId = asTrimmedString(context.wakeCommentId) || asTrimmedString(context.commentId) || asTrimmedString(config.commentId);
  const approvalId = asTrimmedString(context.approvalId) || asTrimmedString(config.approvalId);
  const approvalStatus = asTrimmedString(context.approvalStatus) || asTrimmedString(config.approvalStatus);
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value) => typeof value === 'string' && value.trim()).join(', ')
    : '';
  const wakeReason = asTrimmedString(context.wakeReason) || asTrimmedString(config.wakeReason);
  const paperclipApiUrl = normalizePaperclipApiUrl(
    asTrimmedString(config.paperclipApiUrl) ||
    asTrimmedString(process.env.PAPERCLIP_API_URL) ||
    'http://127.0.0.1:3100/api'
  );
  const workspaceSummary = summarizeWorkspace(context);
  const agentConfig = asRecord(ctx.agent?.adapterConfig);

  const permissions = asRecord(ctx.agent?.permissions);
  const canCreateAgents = Boolean(permissions.canCreateAgents);
  const hireModel =
    asTrimmedString(agentConfig.model) ||
    asTrimmedString(config.model);
  const hireModelLine = hireModel ? `,\n    "model":"${hireModel}"` : '';

  return {
    agentId: asTrimmedString(ctx.agent?.id),
    agentName: asTrimmedString(ctx.agent?.name, 'Hermes Agent'),
    companyId: asTrimmedString(ctx.agent?.companyId),
    companyName: asTrimmedString(context.companyName) || asTrimmedString(config.companyName),
    runId: asTrimmedString(ctx.runId),
    taskId,
    taskTitle,
    taskBody,
    commentId,
    approvalId,
    approvalStatus,
    linkedIssueIds,
    wakeReason,
    workspaceSummary,
    paperclipApiUrl,
    canCreateAgents,
    hireModel,
    hireModelLine,
    noTask: !taskId,
  };
}

/**
 * @param {string} raw
 */
export function normalizePaperclipApiUrl(raw) {
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/**
 * Build the final prompt text.
 *
 * @param {any} ctx
 * @param {Record<string, unknown>} config
 */
export function buildPrompt(ctx, config) {
  const template = asTrimmedString(config.promptTemplate) || DEFAULT_PROMPT_TEMPLATE;
  const bootstrap = asTrimmedString(config.bootstrapPromptTemplate);
  const vars = buildPromptVars(ctx, config);
  const renderedMain = renderTemplate(renderConditionals(template, vars), vars);
  const renderedBootstrap = bootstrap ? renderTemplate(renderConditionals(bootstrap, vars), vars) : '';
  const instructions = asTrimmedString(config.injectedInstructions);
  return joinPromptSections([instructions, renderedBootstrap, renderedMain]);
}
