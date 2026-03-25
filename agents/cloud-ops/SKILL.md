---
name: cloud-ops
description: >
  Manage cloud infrastructure operations in Paperclip: provision environments via IaC,
  run CI/CD pipelines, monitor uptime SLAs, analyse cloud costs, and enforce security
  compliance. Use for any cloud infrastructure lifecycle task — IaC changes, deployments,
  incident triage, cost analysis, or compliance checks.
---

# Cloud Operations Skill

Use this skill when you need to interact with cloud infrastructure, CI/CD pipelines, uptime monitoring, cost data, or security posture from within a Paperclip agent.

## Preconditions

You need:

- Agent API key (`$PAPERCLIP_API_KEY`) with company access
- Cloud provider credentials injected via Paperclip secrets (AWS, Azure, or GCP)
- The company ID (`$PAPERCLIP_COMPANY_ID`)

For IaC operations: Terraform/OpenTofu installed in the agent runtime.
For CI/CD operations: `$GH_TOKEN` configured for GitHub Actions access.
For observability: Datadog/Prometheus API access configured via secrets.

## Workflow

### 1. Check Current Infrastructure State

Before making any change, understand the current state:

```bash
# View recent activity (last 50 events)
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/activity?limit=50" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Check open incidents (P1/P2 blockers)
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues?status=open&priority=p1,p2" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

If any P1/P2 incidents are open, **do not deploy**. Resolve incidents first or get explicit sign-off from the SRE.

### 2. IaC Change Workflow

```bash
# Step 1: Validate IaC
terraform validate

# Step 2: Security scan (must pass before plan)
checkov -d . --compact --quiet
tfsec . --exclude-downloaded-modules

# Step 3: Plan with cost estimation
terraform plan -out=tfplan
infracost breakdown --path .

# Step 4: Request security gate review (post to Paperclip)
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "IaC plan ready for security gate review. checkov: PASS. tfsec: PASS. Estimated cost delta: $X/month. Requesting DriftGuard review."
  }'
```

### 3. Deployment Workflow

For CI/CD-managed deployments (preferred — zero-touch policy):

```bash
# Trigger pipeline via GitHub Actions dispatch
curl -sS -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -d '{
    "ref": "main",
    "inputs": {
      "environment": "production",
      "issue_id": "'$ISSUE_ID'"
    }
  }'
```

**Never run `terraform apply` or `kubectl apply` manually outside the CI/CD pipeline.** A manual apply is a P2 incident — report it to the SRE immediately.

### 4. Post-Deployment Verification

```bash
# Check pipeline run status
curl -sS \
  -H "Authorization: Bearer $GH_TOKEN" \
  "https://api.github.com/repos/{owner}/{repo}/actions/runs?event=workflow_dispatch&per_page=5"

# Verify health endpoint
curl -sS -o /dev/null -w "%{http_code}" "https://{service-endpoint}/health"

# Update Paperclip issue with outcome
curl -sS -X PATCH "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

### 5. Incident Triage Workflow

When an alert fires:

```bash
# 1. Identify severity from alert metadata
# 2. Create incident issue in Paperclip
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "[P{severity}] {alert-name} — {affected-service}",
    "body": "## Alert\n{alert-details}\n\n## Initial Assessment\n{blast-radius}\n\n## Runbook\n{runbook-link}",
    "assigneeId": "{sre-agent-id}"
  }'

# 3. For P3/P4: execute runbook automatically
# 4. For P1/P2: escalate to CloudCTO within 5 minutes
```

### 6. Cost Check Workflow

Before any infrastructure change, estimate cost impact:

```bash
# Get current company cost summary
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/costs/summary" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Use infracost for IaC changes
infracost diff --path . --compare-to previous.json

# If estimated increase > 10%, escalate to CostSage before proceeding
```

## Decision Framework

Before any cloud operation, answer:

1. **Is there an active P1/P2 incident?** → If yes, stop. Resolve incident first.
2. **Does this change require IaC?** → If yes, run security gate (checkov + tfsec) first.
3. **What is the estimated cost delta?** → If > approved threshold, escalate to FinOps.
4. **What is the blast radius if this change fails?** → Document in issue before proceeding.
5. **Is there an automated rollback plan?** → If no, do not deploy to production.

## Quality Bar

Before marking a cloud operations task complete:

- [ ] Security gate passed (checkov + tfsec: zero HIGH/CRITICAL findings)
- [ ] Cost impact estimated and within approved threshold
- [ ] No active P1/P2 incidents at time of deployment
- [ ] Deployment executed via CI/CD pipeline (not manually)
- [ ] Post-deploy health check passed
- [ ] Paperclip issue updated with outcome, cost event reported
- [ ] Any rollback executed was recorded as an incident
