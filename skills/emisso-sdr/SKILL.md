---
name: sdr
description: SDR agent — manage folder-native CRM pipeline, enrich companies, draft outreach emails, and track the sales pipeline. Use for prospecting, outreach, and pipeline management.
context: fork
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebSearch
  - WebFetch
---

# SDR Agent Skill

Manage Emisso's sales pipeline through a folder-native CRM at `sdr/`. Find prospects, research companies, draft personalized emails, and track pipeline stages — all as YAML/Markdown files.

## Arguments

Parse `$ARGUMENTS` for the command:

- `(no args)` — Full pipeline run: check all leads, execute due actions, update dashboard
- `prospect` — Find new companies matching ICP via web search
- `enrich <company>` — Deep-research a company, find contacts, find & verify emails
- `draft <company>` — Draft the next email in sequence for a company
- `move <company> <stage>` — Move company to a pipeline stage (e.g., `contacted`, `replied`)
- `add <company> <domain>` — Add a new lead to prospecting
- `dashboard` — Regenerate the pipeline summary
- `review` — Show all pending drafts for approval
- `status` — Quick pipeline stats

## File Locations

All data lives in `sdr/` at the repo root:

```
sdr/
├── config/
│   ├── icp.yml              # ICP definition and scoring
│   ├── tone.md              # Email voice guidelines
│   ├── sending.yml          # Sending infrastructure config
│   └── sequences/           # Email sequence templates
│       ├── cold-intro.yml
│       └── warm-intro.yml
├── pipeline/
│   ├── 01-prospecting/      # New leads
│   ├── 02-contacted/        # First email sent
│   ├── 03-replied/          # Got a response
│   ├── 04-meeting-booked/   # Meeting scheduled
│   ├── 05-qualified/        # Good fit confirmed
│   ├── 06-won/              # Closed
│   ├── 07-lost/             # Dead
│   └── _dashboard.md        # Pipeline summary
├── contacts/                # Contact files
├── enrichment/              # Company research
├── drafts/                  # Email drafts awaiting approval
└── logs/                    # Daily activity logs
```

## Commands

### `/sdr` (full pipeline run)

This is the default when called from `/loop`. Execute in order:

1. **Read config** — Load `sdr/config/icp.yml`, `sdr/config/tone.md`, `sdr/config/sending.yml`
2. **Scan pipeline** — Glob all `.yml` files across `sdr/pipeline/*/` and read each
3. **Identify due actions** — Find leads where `next_action_date <= today`
4. **Execute actions:**
   - If `next_action: draft_step_N` → draft the next email, save to `sdr/drafts/`
   - If `next_action: check_reply` → note it needs manual checking (Phase 1)
   - If `next_action: follow_up` → draft follow-up email
5. **Update dashboard** — Regenerate `sdr/pipeline/_dashboard.md`
6. **Write log** — Append today's actions to `sdr/logs/YYYY-MM-DD.md`

### `/sdr prospect`

Find new companies that match the ICP:

1. Read `sdr/config/icp.yml` for target criteria
2. Web search for companies matching signals:
   - Search: `"[industry] startup [geography] Series A 2025 2026"`
   - Search: `"[industry] company hiring engineers [geography]"`
   - Search: `site:linkedin.com "[industry]" "[role]" "[geography]"`
3. For each candidate:
   - Check if already in pipeline (search `sdr/pipeline/`)
   - Score against ICP criteria
   - If score >= threshold, create a prospect file
4. Save new prospects to `sdr/pipeline/01-prospecting/`
5. Report what was found

### `/sdr enrich <company>`

Deep-research a specific company, find decision-makers, and find & verify their emails.

**Step 1 — Company Research:**

1. Find the company file in `sdr/pipeline/`
2. Read the company's domain
3. Research using web search:
   - Company website (about, team, careers pages)
   - Recent news and press releases
   - LinkedIn company page
   - Tech stack / SaaS tools they use (job postings are great for this)
   - Recent funding or growth events
   - Estimate their SaaS spend (headcount × typical per-seat pricing)

**Step 2 — Find Decision-Makers:**

4. Search for people at the company matching target roles from `sdr/config/icp.yml`:
   - Search: `site:linkedin.com "[company name]" (CFO OR COO OR CTO OR "gerente de finanzas" OR "gerente general")`
   - Search: `"[company name]" "[role]" email OR contact`
   - Check the company's team/about page
5. For each contact found, record: name, role, LinkedIn URL

**Step 3 — Find & Verify Emails:**

6. For each contact, run the email finder tool:
   ```bash
   node sdr/tools/find-email.mjs --first "Patrick" --last "Hardy" --domain "thewildfoods.com" --alt-domain "thewildbrands.com"
   ```
   The tool automatically:
   - Generates all common email patterns (first@, first.last@, flast@, etc.)
   - Checks MX records to confirm the domain receives email
   - Detects if the provider blocks SMTP verification (Google, Microsoft, etc.)
   - For non-blocked providers: runs SMTP RCPT TO verification per candidate
   - For blocked providers: returns top patterns as `pattern-match`
   - Detects catch-all domains
   - Returns JSON with confidence levels

   If the company has a parent/alternate domain (found during research), pass it as `--alt-domain`.

7. Also web-search for their email directly as a cross-check:
   - Search: `"[name]" "@[domain]" OR "email"`
   - Search: `"[name]" "[company]" email OR contact`
   - If found via web search, mark as `web-found` (higher confidence than pattern-match)

8. Confidence levels:
   - `verified` — SMTP confirmed the mailbox exists
   - `web-found` — found via web search (LinkedIn, company page, public records)
   - `pattern-match` — matches common pattern, MX valid, but couldn't SMTP verify
   - `guess` — no MX records or domain doesn't receive email

**Step 4 — Write Results:**

11. Write enrichment to `sdr/enrichment/<company-slug>.md`:

```markdown
# [Company Name] — Enrichment

**Domain:** example.com
**Researched:** YYYY-MM-DD

## Company Overview
[1-2 paragraphs: what they do, who they serve]

## Team & Size
[Key people, team size, growth trajectory]

## SaaS Spend Estimate
[Table: category, likely tool, estimated monthly cost]
[Total estimated SaaS spend]

## Buying Signals
[Funding, hiring, growth indicators]

## Personalization Hooks
[Specific things to reference in outreach — recent blog posts, product launches, hiring posts]

## Contacts & Emails
| Name | Role | Email | Confidence | Source |
|------|------|-------|------------|--------|
| Patrick Hardy | COO | patrick@thewildfoods.com | verified | SMTP check |
| Rodrigo Paredes | Head of Digital Transformation | rparedes@thewildfoods.com | pattern-match | MX valid, common pattern |
```

12. Update the company's pipeline YAML with contacts and emails:
    ```yaml
    contacts:
      - name: Patrick Hardy
        role: COO
        email: patrick@thewildfoods.com
        email_confidence: verified
        linkedin: https://linkedin.com/in/...
    ```

13. Set `next_action: draft_step_1` if at least one email was found.
    Set `next_action: find_email_manually` if no emails could be found (needs human help).

### `/sdr draft <company>`

Draft the next email in sequence:

1. Find the company in `sdr/pipeline/`
2. Read its current `sequence` and `sequence_step`
3. Load the sequence template from `sdr/config/sequences/`
4. Load `sdr/config/tone.md` for voice guidelines
5. Load enrichment from `sdr/enrichment/` if available
6. Draft the email following:
   - Sequence step guidelines
   - Tone rules
   - Personalization from enrichment data
7. Save draft to `sdr/drafts/<company-slug>--step-<N>.md`:

```markdown
# Draft: [Company Name] — Step [N]

**To:** [contact email]
**Subject:** [subject line]
**Sequence:** [sequence name]
**Step:** [N] of [total]

---

[email body]

---

**Personalization used:**
- [list of specific details referenced]

**To send:** Copy the email body above and send manually. Then run `/sdr move <company> contacted`
```

### `/sdr move <company> <stage>`

Move a company between pipeline stages:

1. Find the company file in `sdr/pipeline/`
2. Move the file to the target stage directory:
   - `prospecting` → `01-prospecting/`
   - `contacted` → `02-contacted/`
   - `replied` → `03-replied/`
   - `meeting-booked` → `04-meeting-booked/`
   - `qualified` → `05-qualified/`
   - `won` → `06-won/`
   - `lost` → `07-lost/`
3. Update the file's metadata:
   - Set `last_action` to today
   - Update `next_action` and `next_action_date` based on stage:
     - `contacted` → `next_action: draft_step_2`, date: +3 days
     - `replied` → `next_action: respond`, date: today (urgent)
     - `meeting-booked` → `next_action: prepare_meeting`, date: meeting date - 1 day
4. Use `git mv` to preserve history

### `/sdr add <company> <domain>`

Add a new lead to the pipeline:

1. Create `sdr/pipeline/01-prospecting/<company-slug>.yml`:

```yaml
name: [Company Name]
domain: [domain]
industry: unknown
size: unknown
location: unknown
score: 0
match_reasons: []

contacts: []

sequence: cold-intro
sequence_step: 0
last_action: [today]
next_action: enrich
next_action_date: [today]

notes: |
  Added manually via /sdr add
```

2. Suggest running `/sdr enrich <company>` next

### `/sdr dashboard`

Regenerate `sdr/pipeline/_dashboard.md`:

1. Glob all `.yml` files in each pipeline stage directory
2. Count leads per stage
3. List companies with their scores and next actions
4. Highlight urgent items (next_action_date <= today)
5. Write the updated dashboard

### `/sdr review`

Show all pending drafts:

1. Glob `sdr/drafts/*.md`
2. Read each draft
3. Present them for review with send instructions

### `/sdr status`

Quick stats without full pipeline run:

1. Count files in each pipeline stage
2. Count pending drafts
3. Show today's log if it exists

## Company File Schema

Every company in the pipeline uses this YAML structure:

```yaml
name: string              # Company name
domain: string            # Company website domain
industry: string          # Industry category
size: string              # Employee count range (e.g., "50-200")
location: string          # HQ location
score: number             # ICP match score (0-100)
match_reasons: string[]   # Why they match the ICP

contacts:
  - name: string
    role: string
    email: string
    email_confidence: string  # verified | pattern-match | web-found | guess
    linkedin: string          # LinkedIn profile URL

sequence: string          # Current sequence name (from config/sequences/)
sequence_step: number     # Current step in sequence (0 = not started)
last_action: date         # YYYY-MM-DD
next_action: string       # What to do next
next_action_date: date    # When to do it

notes: |                  # Freeform notes, interaction history
  Multi-line notes here.
```

## Rules

- **Never send emails automatically in Phase 1** — always draft to `sdr/drafts/`
- **Always read `config/tone.md`** before writing any email
- **Always check enrichment** before drafting (run enrich first if missing)
- **Respect the "no"** — if a company is moved to `lost`, never re-add them
- **Log everything** — append to `sdr/logs/YYYY-MM-DD.md` after any action
- **Keep it short** — emails should be 4-6 sentences for first touch, shorter for follow-ups
- **One contact per company** — target the most senior relevant person
- **Use git mv** for moving files between pipeline stages (preserves history)
- **Score honestly** — don't inflate scores to fill the pipeline
- **Spanish for LatAm** — English for US/international prospects
