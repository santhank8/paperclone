#!/usr/bin/env bash
# seed-vqnc-swarm.sh — Expand VQNC org with 10-agent Swarm Income Plan
# Adds operational agents, 4 revenue stream projects, and Day 1-30 tasks

set -euo pipefail

API="http://127.0.0.1:3101/api"
COMPANY_ID="d24377aa-2dd7-47e2-99c5-a28d0c0b6515"

# Existing executive IDs
CEO_ID="657a28ce-85d4-4e0c-8a2a-5f5a60f40ad4"
CTO_ID="0b8714e8-53c3-4a8e-a47f-737f0abf5faa"
CMO_ID="b48e81dc-4151-45a0-9da3-6d81896b2ceb"
ENGINEER_ID="26403849-72b2-43a9-8825-5bed4ad26a62"
HERMES_ID="32f85190-144f-48aa-94ca-25206077f415"

# Existing goals
COMPANY_GOAL_ID="ee0011f5-301a-4966-a732-91c48049693c"

echo "=== VQNC Swarm Income Plan — Organization Expansion ==="
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1. Rename existing Engineer → agent_dev_01
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [1/7] Renaming Engineer → agent_dev_01..."

curl -s -X PATCH "$API/agents/$ENGINEER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "agent_dev_01",
    "title": "Infrastructure & Build Lead",
    "capabilities": "Infrastructure, web development, Netlify deployments, digital product building, template packaging, landing pages. Primary stream: Client Services + Digital Products.",
    "icon": "code"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ {d[\"name\"]} ({d[\"title\"]})')"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 2. Create 8 new operational agents
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [2/7] Creating operational agents..."

# agent_crm_02 — Sales & Prospecting → reports to CMO
CRM_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_crm_02\",
    \"role\": \"general\",
    \"title\": \"Sales & Prospecting Lead\",
    \"icon\": \"target\",
    \"reportsTo\": \"$CMO_ID\",
    \"capabilities\": \"Apollo prospecting, lead enrichment, outreach sequences, follow-up, affiliate program management. Primary stream: Client Services + Affiliate.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 5000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_crm_02 (Sales & Prospecting) → $CRM_ID"

# agent_mkt_03 — Marketing & Content → reports to CMO
MKT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_mkt_03\",
    \"role\": \"general\",
    \"title\": \"Marketing & Content Lead\",
    \"icon\": \"rocket\",
    \"reportsTo\": \"$CMO_ID\",
    \"capabilities\": \"Script writing, SEO optimization, social media posting, newsletter drafts, HeyGen video content, YouTube/TikTok publishing. Primary stream: Content Engine + Digital Products.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 5000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_mkt_03 (Marketing & Content) → $MKT_ID"

# agent_cx_01 — Client Experience → reports to CEO
CX_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_cx_01\",
    \"role\": \"general\",
    \"title\": \"Client Experience Lead\",
    \"icon\": \"heart\",
    \"reportsTo\": \"$CEO_ID\",
    \"capabilities\": \"Client automation delivery, onboarding, support tickets, satisfaction tracking. Primary stream: Client Services.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 5000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_cx_01 (Client Experience) → $CX_ID"

# agent_ops_07 — Operations & Deploy → reports to CTO
OPS_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_ops_07\",
    \"role\": \"devops\",
    \"title\": \"Operations & Deploy Lead\",
    \"icon\": \"wrench\",
    \"reportsTo\": \"$CTO_ID\",
    \"capabilities\": \"Deployment pipelines, Netlify management, infrastructure monitoring, Google Search Console, DNS configuration. Failover for agent_dev_01.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 5000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_ops_07 (Operations & Deploy) → $OPS_ID"

# agent_sched_01 — Scheduling & Tasks → reports to CMO
SCHED_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_sched_01\",
    \"role\": \"general\",
    \"title\": \"Scheduling & Automation Lead\",
    \"icon\": \"cog\",
    \"reportsTo\": \"$CMO_ID\",
    \"capabilities\": \"HeyGen task execution, publishing calendar, cross-posting schedule, deal scraping automation, price comparison. Primary stream: Content Engine + Affiliate.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 3000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_sched_01 (Scheduling) → $SCHED_ID"

# agent_data_04 — Data & Analytics → reports to CTO
DATA_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_data_04\",
    \"role\": \"researcher\",
    \"title\": \"Data & Analytics Lead\",
    \"icon\": \"database\",
    \"reportsTo\": \"$CTO_ID\",
    \"capabilities\": \"CPM tracking, subscriber growth analysis, affiliate conversion tracking, content performance, SEO health monitoring, competitive intelligence.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 3000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_data_04 (Data & Analytics) → $DATA_ID"

# agent_report_02 — Reporting & Finance → reports to CEO
REPORT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_report_02\",
    \"role\": \"cfo\",
    \"title\": \"Reporting & Finance Lead\",
    \"icon\": \"eye\",
    \"reportsTo\": \"$CEO_ID\",
    \"capabilities\": \"Revenue reporting, P&L generation, financial trend analysis, budget tracking across all 4 revenue streams.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 3000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_report_02 (Reporting & Finance) → $REPORT_ID"

# agent_sec_01 — Security & Compliance → reports to CTO
SEC_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"agent_sec_01\",
    \"role\": \"devops\",
    \"title\": \"Security & Compliance Lead\",
    \"icon\": \"shield\",
    \"reportsTo\": \"$CTO_ID\",
    \"capabilities\": \"Security audits, secret management, compliance checks, API key rotation, client data protection. Primary stream: Client Services.\",
    \"adapterType\": \"codex_local\",
    \"budgetMonthlyCents\": 2000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ agent_sec_01 (Security & Compliance) → $SEC_ID"

# ARIA — Final Fallback Lead → reports to CEO
ARIA_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/agents" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"ARIA\",
    \"role\": \"pm\",
    \"title\": \"Final Fallback Lead\",
    \"icon\": \"sparkles\",
    \"reportsTo\": \"$CEO_ID\",
    \"capabilities\": \"Content QA, product quality review, brand consistency enforcement, research continuation, CLI instructions dispatch to Wilmer. Failover for ALL agents. ARIA never drops the ball.\",
    \"adapterType\": \"openclaw_gateway\",
    \"budgetMonthlyCents\": 10000
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ ARIA (Final Fallback Lead) → $ARIA_ID"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 3. Create revenue stream goals
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [3/7] Creating revenue stream goals..."

CLIENT_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Client Services: \$5K–\$8K/mo from AI automation retainers\",
    \"description\": \"Position VQNC as AI automation studio for SMBs. Rates: \$150–\$250/hr consulting, \$2K–\$8K/mo retainers, \$5K–\$25K project engagements. Target: 4–5 active retainers by Day 90.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CEO_ID\"
  }" | python3 -c "import sys,json; print(d['id']) if (d:=json.load(sys.stdin)) else print('ERROR')")
echo "  ✓ Client Services goal → $CLIENT_GOAL_ID"

CONTENT_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Content Engine: \$1K–\$3K/mo from video + newsletter + affiliate\",
    \"description\": \"HeyGen video pipeline, YouTube/TikTok channels, Beehiiv newsletter as content flywheel. AI/tech niche CPM: \$15–\$22. Monetize via ads + affiliate links.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; print(d['id']) if (d:=json.load(sys.stdin)) else print('ERROR')")
echo "  ✓ Content Engine goal → $CONTENT_GOAL_ID"

PRODUCTS_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Digital Products: \$1K–\$2K/mo from templates and prompt packs\",
    \"description\": \"Sell AI automation templates, prompt packs, workflow blueprints on Lemon Squeezy (5% + \$0.50 fee). Build once, sell forever. Target: 100–300 units/month at \$19–\$79 average.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CTO_ID\"
  }" | python3 -c "import sys,json; print(d['id']) if (d:=json.load(sys.stdin)) else print('ERROR')")
echo "  ✓ Digital Products goal → $PRODUCTS_GOAL_ID"

AFFILIATE_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Affiliate & Get Me a Deal: \$500–\$2K/mo from commissions\",
    \"description\": \"Get Me a Deal affiliate brand. Daily deal roundups with affiliate links. Programs: Amazon Associates, ShareASale, CJ Affiliate, Impact, plus AI tool affiliates (Mixo 50%, Pictory 50%, Jasper 30%).\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; print(d['id']) if (d:=json.load(sys.stdin)) else print('ERROR')")
echo "  ✓ Affiliate goal → $AFFILIATE_GOAL_ID"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 4. Create 4 revenue stream projects
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [4/7] Creating revenue stream projects..."

CLIENT_PROJECT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Client Services Pipeline\",
    \"description\": \"Primary income driver. AI automation studio for SMBs. Fix vqnclabs.com, activate chat widget, launch Apollo prospecting, close pilot projects, convert to retainers. Target: \$5K–\$8K/mo by Day 90.\",
    \"status\": \"in_progress\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"leadAgentId\": \"$CRM_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Client Services Pipeline → $CLIENT_PROJECT_ID"

CONTENT_PROJECT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Content Engine\",
    \"description\": \"HeyGen video pipeline + YouTube/TikTok + Beehiiv newsletter. Content builds authority, drives organic leads, monetizes through ads + affiliate links. Target: \$1K–\$3K/mo by Day 90.\",
    \"status\": \"planned\",
    \"goalId\": \"$CONTENT_GOAL_ID\",
    \"leadAgentId\": \"$MKT_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Content Engine → $CONTENT_PROJECT_ID"

PRODUCTS_PROJECT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Digital Products Store\",
    \"description\": \"AI automation templates, prompt packs, workflow blueprints on Lemon Squeezy. 5 products at \$19–\$79. Target: \$1K–\$2K/mo by Day 90.\",
    \"status\": \"planned\",
    \"goalId\": \"$PRODUCTS_GOAL_ID\",
    \"leadAgentId\": \"$ENGINEER_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Digital Products Store → $PRODUCTS_PROJECT_ID"

AFFILIATE_PROJECT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Get Me a Deal — Affiliate Engine\",
    \"description\": \"Affiliate marketing brand. Daily deal roundups, social cross-promotion, embedded in HeyGen videos and newsletters. Target: \$500–\$2K/mo by Day 90.\",
    \"status\": \"planned\",
    \"goalId\": \"$AFFILIATE_GOAL_ID\",
    \"leadAgentId\": \"$SCHED_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Get Me a Deal → $AFFILIATE_PROJECT_ID"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 5. Seed Day 1-30 Foundation tasks (Week 1-4)
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [5/7] Creating Day 1-30 Foundation tasks..."

# ---- WEEK 1: Critical Path ----

# BLOCKER: Initialize Paperclip session log
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[BLOCKER] Initialize Paperclip session log\",
    \"description\": \"Create the shared swarm communication log:\\n\\\`\\\`\\\`bash\\nmkdir -p ~/Desktop/COMPLETE\\\\ IT\\\\ TODAY/.paperclip\\ntouch ~/Desktop/COMPLETE\\\\ IT\\\\ TODAY/.paperclip/session.log\\n\\\`\\\`\\\`\\nMessage format: PAPERCLIP:{JSON} appended to session.log. Every agent reads/writes this log.\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$OPS_ID\"
  }" > /dev/null && echo "  ✓ [BLOCKER] Initialize Paperclip session log"

# BLOCKER: Fix DNS on Mac
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[BLOCKER] Fix DNS on Mac\",
    \"description\": \"Set Google + Cloudflare DNS, flush cache, restart mDNSResponder:\\n\\\`\\\`\\\`bash\\nsudo networksetup -setdnsservers Wi-Fi 8.8.8.8 1.1.1.1\\nsudo dscacheutil -flushcache\\nsudo killall -HUP mDNSResponder\\n\\\`\\\`\\\`\\nRequired for: OpenClaw, Hermes, all external API calls.\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\"
  }" > /dev/null && echo "  ✓ [BLOCKER] Fix DNS on Mac"

# BLOCKER: Fix Formspree ID
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[BLOCKER] Replace Formspree REPLACE_ME ID in vqnc-audit.html\",
    \"description\": \"The chat widget intake form is broken. Steps:\\n1. Create form at formspree.io\\n2. Copy the form ID\\n3. Replace REPLACE_ME in vqnc-audit.html with the real ID\\n4. Deploy to Netlify\\n\\nNothing converts without this. It's the lead funnel.\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" > /dev/null && echo "  ✓ [BLOCKER] Fix Formspree ID"

# Fix vqnclabs.com (all 9 items)
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Fix vqnclabs.com — all 9 open items\",
    \"description\": \"Complete website fixes for the lead funnel:\\n1. Hero copy\\n2. Social proof section\\n3. Chat widget integration\\n4. Page consolidation\\n5. Font standardization\\n6. Footer completion\\n7. SEO meta tags\\n8. Mobile responsiveness\\n9. Performance optimization\\n\\nThis is the lead funnel. Nothing converts without it.\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" > /dev/null && echo "  ✓ Fix vqnclabs.com (all 9 items)"

# Submit to Google Search Console
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Submit sitemap to Google Search Console\",
    \"description\": \"Currently invisible to Google. Zero organic traffic until this is done.\\n1. Add property at search.google.com/search-console\\n2. Verify via DNS TXT record\\n3. Submit sitemap.xml\\n4. Verify indexing begins within 48 hours\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$OPS_ID\"
  }" > /dev/null && echo "  ✓ Submit sitemap to Google Search Console"

# ---- WEEK 2: Content + Products ----

# Fix HeyGen scheduled task
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Fix HeyGen scheduled task\",
    \"description\": \"Three fixes required:\\n1. Add credit-check API call at task start (NEVER trigger without credits)\\n2. Fix Chrome extension disconnect — build retry/reconnect logic\\n3. Add low-credit alert notification\\n\\nCredits are depleted — top up at app.heygen.com → Billing before testing.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$CONTENT_PROJECT_ID\",
    \"goalId\": \"$CONTENT_GOAL_ID\",
    \"assigneeAgentId\": \"$SCHED_ID\"
  }" > /dev/null && echo "  ✓ Fix HeyGen scheduled task"

# Launch YouTube + Beehiiv
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Launch YouTube channel (VQNC News) + Beehiiv newsletter (VQNC Weekly)\",
    \"description\": \"Week 2 deliverables:\\n- Create YouTube channel (VQNC News)\\n- Upload first 4 HeyGen videos with SEO-optimized titles/descriptions/tags\\n- Create Beehiiv newsletter (VQNC Weekly)\\n- Repurpose video scripts into first newsletter issue\\n- Set up Beehiiv ad network monetization\\n\\nAI/tech niche CPM: \$15–\$22. Median first dollar from newsletter: 66 days.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$CONTENT_PROJECT_ID\",
    \"goalId\": \"$CONTENT_GOAL_ID\",
    \"assigneeAgentId\": \"$MKT_ID\"
  }" > /dev/null && echo "  ✓ Launch YouTube + Beehiiv"

# Build first 2 digital products
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build 2 digital products: Prompt Pack (\$29) + AI Agent Starter Kit (\$49)\",
    \"description\": \"Week 2 — first products on Lemon Squeezy:\\n\\n**Prompt Engineering Pack (\$29)**\\n- 200+ prompts organized by use case\\n- Framework documentation\\n- Target: 20 sales/mo = \$580/mo\\n\\n**AI Agent Starter Kit (\$49)**\\n- n8n/Make templates\\n- Setup guide\\n- Target: 10 sales/mo = \$490/mo\\n\\nLemon Squeezy takes 5% + \$0.50 per sale.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$PRODUCTS_PROJECT_ID\",
    \"goalId\": \"$PRODUCTS_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" > /dev/null && echo "  ✓ Build first 2 digital products"

# ---- WEEK 3: Sales + Affiliate ----

# Start Apollo prospecting
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Start Apollo prospecting — 50 South Florida SMBs/week\",
    \"description\": \"Launch cold outreach pipeline:\\n1. Set up Apollo prospect skill\\n2. Target verticals: logistics, law, real estate, healthcare, e-commerce\\n3. Enrichment + 3-touch outreach sequence\\n4. 50 prospects/week minimum\\n5. Track response rates and conversion\\n\\nGoal: book 3–5 discovery calls in first 2 weeks.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$CRM_ID\"
  }" > /dev/null && echo "  ✓ Start Apollo prospecting"

# Build Get Me a Deal site
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build Get Me a Deal landing page + first 10 affiliate links\",
    \"description\": \"Static HTML on Netlify (same stack as VQNC Labs):\\n- Landing page with deal card layout\\n- First 10 curated affiliate links\\n- Social media accounts (Twitter, Instagram)\\n- Signup for: Amazon Associates, ShareASale, CJ Affiliate, Impact\\n- Plus AI tool affiliates: Mixo (50% lifetime), Pictory (50%), Jasper (30%), Thinkific (30% lifetime)\\n\\nCookie windows: 60–90 days.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$AFFILIATE_PROJECT_ID\",
    \"goalId\": \"$AFFILIATE_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" > /dev/null && echo "  ✓ Build Get Me a Deal site"

# ---- WEEK 4: Close + Scale ----

# Close first pilot client
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Close first pilot client — \$3K–\$5K AI automation project\",
    \"description\": \"Target: 1 South Florida SMB for a pilot engagement.\\n- agent_crm_02 qualifies leads from Apollo pipeline\\n- Wilmer takes the discovery call\\n- agent_cx_01 handles onboarding and delivery\\n- Convert to \$2K–\$4K/mo retainer after successful delivery\\n\\nThis is the first real revenue. Everything else compounds from here.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$CRM_ID\"
  }" > /dev/null && echo "  ✓ Close first pilot client"

# Build 3 more digital products
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build 3 more products: Playbook (\$79), Intake Template (\$39), Content Blueprint (\$59)\",
    \"description\": \"Week 4 — complete the product line:\\n\\n**SMB Automation Playbook (\$79)** — PDF + video walkthrough. 5 sales/mo = \$395\\n**Client Intake Automation (\$39)** — Template + Formspree setup. 5 sales/mo = \$195\\n**AI Content Pipeline Blueprint (\$59)** — HeyGen + newsletter SOP. 5 sales/mo = \$295\\n\\nTotal product line: 5 products, avg \$51, target \$1,955/mo conservative.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$PRODUCTS_PROJECT_ID\",
    \"goalId\": \"$PRODUCTS_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" > /dev/null && echo "  ✓ Build 3 more digital products"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 6. Seed Day 31-90 Scale + Compound tasks
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [6/7] Creating Day 31-90 Scale + Compound tasks..."

# Week 5-6: Scale content
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Scale content to 12 videos/month (3/week)\",
    \"description\": \"Scale HeyGen video production:\\n- 3 videos/week via HeyGen\\n- Repurpose each to newsletter + social clips\\n- Cross-post short clips to TikTok and Instagram Reels\\n- AI tutorials niche growing 340% YoY\\n\\nDepends on: HeyGen task fix + credit top-up.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$CONTENT_PROJECT_ID\",
    \"goalId\": \"$CONTENT_GOAL_ID\",
    \"assigneeAgentId\": \"$MKT_ID\"
  }" > /dev/null && echo "  ✓ Scale content to 12 videos/month"

# Weekly SEO monitor
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Launch weekly SEO health monitor (scheduled automation)\",
    \"description\": \"Build scheduled task that runs weekly:\\n- Check Google rankings for target keywords\\n- Verify canonical URLs\\n- Report crawl errors\\n- Track organic traffic growth\\n- Alert on ranking drops > 5 positions\\n\\nThis is Skill #3 from the skills roadmap.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$CLIENT_GOAL_ID\",
    \"assigneeAgentId\": \"$DATA_ID\"
  }" > /dev/null && echo "  ✓ Launch weekly SEO monitor"

# Automate daily deal posts
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Automate daily deal posts for Get Me a Deal\",
    \"description\": \"Build Skill #5 (Daily Deal Finder):\\n- Scheduled task scrapes trending deals\\n- Writes short-form posts with affiliate links\\n- Auto-publishes to social accounts\\n- Cross-promote in HeyGen videos and VQNC newsletter\\n\\nScript 3 of existing HeyGen content is already a Get Me a Deal ad.\",
    \"status\": \"backlog\",
    \"priority\": \"low\",
    \"projectId\": \"$AFFILIATE_PROJECT_ID\",
    \"goalId\": \"$AFFILIATE_GOAL_ID\",
    \"assigneeAgentId\": \"$SCHED_ID\"
  }" > /dev/null && echo "  ✓ Automate daily deal posts"

# Monthly P&L Reporter
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build Monthly P&L Reporter (scheduled automation)\",
    \"description\": \"Skill #7 — auto-generate monthly revenue report across all 4 streams:\\n- Client Services revenue + retainer status\\n- Content Engine (YouTube CPM, newsletter, affiliate clicks)\\n- Digital Products (Lemon Squeezy sales)\\n- Affiliate commissions\\n- Trend analysis with MoM comparison\\n\\nTarget: available by Week 8 (Day 56).\",
    \"status\": \"backlog\",
    \"priority\": \"low\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$COMPANY_GOAL_ID\",
    \"assigneeAgentId\": \"$REPORT_ID\"
  }" > /dev/null && echo "  ✓ Build Monthly P&L Reporter"

# Get OpenClaw + Hermes online
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Get OpenClaw + Hermes online (DNS fix dependency)\",
    \"description\": \"After DNS blocker is cleared:\\n- Diagnose OpenClaw broken/split install\\n- Get Hermes back online (currently DNS-blocked)\\n- Expand swarm capacity with healthy agent connectivity\\n\\nTarget: Day 90. Depends on DNS fix blocker being resolved.\",
    \"status\": \"backlog\",
    \"priority\": \"low\",
    \"projectId\": \"$CLIENT_PROJECT_ID\",
    \"goalId\": \"$COMPANY_GOAL_ID\",
    \"assigneeAgentId\": \"$SEC_ID\"
  }" > /dev/null && echo "  ✓ Get OpenClaw + Hermes online"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 7. Update company budget to match swarm scale
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [7/7] Updating company budget..."

curl -s -X PATCH "$API/companies/$COMPANY_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "budgetMonthlyCents": 100000
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Company budget → \${d[\"budgetMonthlyCents\"]/100:.0f}/mo')"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VQNC SWARM INCOME PLAN — FULLY LOADED"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Company:     VQNC ($COMPANY_ID)"
echo "  Executives:  CEO, CTO, CMO (management layer)"
echo "  Operators:   agent_dev_01, agent_crm_02, agent_mkt_03,"
echo "               agent_cx_01, agent_ops_07, agent_sched_01,"
echo "               agent_data_04, agent_report_02, agent_sec_01"
echo "  Fallback:    ARIA (never drops the ball)"
echo "  + Hermes:    Telegram outreach specialist"
echo ""
echo "  Revenue Streams:"
echo "    1. Client Services  → \$5K–\$8K/mo  (50–80%)"
echo "    2. Content Engine   → \$1K–\$3K/mo  (10–30%)"
echo "    3. Digital Products  → \$1K–\$2K/mo  (10–20%)"
echo "    4. Affiliate/GMAD   → \$500–\$2K/mo (5–20%)"
echo ""
echo "  TARGET: \$10,000/MONTH RECURRING BY JULY 11, 2026"
echo ""
echo "  Board UI: http://127.0.0.1:3101"
echo "═══════════════════════════════════════════════════════════════"
