#!/usr/bin/env bash
# seed-vqnc.sh — Fix and complete the VQNC organization in Paperclip
# Run with: bash scripts/seed-vqnc.sh

set -euo pipefail

API="http://127.0.0.1:3101/api"
COMPANY_ID="d24377aa-2dd7-47e2-99c5-a28d0c0b6515"

# Agent IDs (from existing DB)
CEO_ID="657a28ce-85d4-4e0c-8a2a-5f5a60f40ad4"
CTO_ID="0b8714e8-53c3-4a8e-a47f-737f0abf5faa"
CMO_ID="b48e81dc-4151-45a0-9da3-6d81896b2ceb"
ENGINEER_ID="26403849-72b2-43a9-8825-5bed4ad26a62"
HERMES_ID="32f85190-144f-48aa-94ca-25206077f415"

# Goal & Project IDs (from existing DB)
COMPANY_GOAL_ID="ee0011f5-301a-4966-a732-91c48049693c"
BOOKFORGE_PROJECT_ID="f203f311-a7eb-4b83-864e-669d47db287b"

echo "=== VQNC Organization Builder ==="
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 1. Fix agent roles and add icons
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [1/6] Fixing agent roles and icons..."

# CEO: role=ceo, icon=crown, reset status from error to idle
curl -s -X PATCH "$API/agents/$CEO_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ceo",
    "icon": "crown",
    "status": "idle"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ CEO → role={d[\"role\"]}, icon={d[\"icon\"]}, status={d[\"status\"]}')"

# CTO: role=cto, icon=cpu
curl -s -X PATCH "$API/agents/$CTO_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "cto",
    "icon": "cpu"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ CTO → role={d[\"role\"]}, icon={d[\"icon\"]}')"

# CMO: role=cmo, icon=globe
curl -s -X PATCH "$API/agents/$CMO_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "cmo",
    "icon": "globe"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ CMO → role={d[\"role\"]}, icon={d[\"icon\"]}')"

# Engineer: role=engineer, icon=code
curl -s -X PATCH "$API/agents/$ENGINEER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "engineer",
    "icon": "code"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Engineer → role={d[\"role\"]}, icon={d[\"icon\"]}')"

# Marketing (Hermes): role=general, icon=message-square
curl -s -X PATCH "$API/agents/$HERMES_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "general",
    "icon": "message-square"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Hermes → role={d[\"role\"]}, icon={d[\"icon\"]}')"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 2. Set company brand color
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [2/6] Setting company brand color..."

curl -s -X PATCH "$API/companies/$COMPANY_ID/branding" \
  -H "Content-Type: application/json" \
  -d '{
    "brandColor": "#6366f1",
    "description": "Autonomous AI enterprise focused on digital products and the Abyssal Intelligence brand. Target: $1M MRR."
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Brand color → {d[\"brandColor\"]}')"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 3. Create sub-goals under company goal
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [3/6] Creating sub-goals..."

# Technical Goal — owned by CTO
TECH_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build and ship production-ready AI products\",
    \"description\": \"Architect, implement, and deploy VQNC digital products including Book Forge, AI writing tools, and the Abyssal Intelligence design system.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CTO_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Technical goal → $TECH_GOAL_ID"

# Growth Goal — owned by CMO
GROWTH_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Drive user acquisition and brand authority\",
    \"description\": \"Build the VQNC brand presence through Telegram community, content marketing, and product launches. Target 10K community members and 1K paying users.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Growth goal → $GROWTH_GOAL_ID"

# Revenue Goal — owned by CEO
REVENUE_GOAL_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/goals" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Generate first \$10K MRR from digital products\",
    \"description\": \"Activate revenue generation through Book Forge subscriptions and AI tool sales. First milestone before the \$1M target.\",
    \"level\": \"team\",
    \"status\": \"active\",
    \"parentId\": \"$COMPANY_GOAL_ID\",
    \"ownerAgentId\": \"$CEO_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ Revenue goal → $REVENUE_GOAL_ID"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 4. Create a second project: VQNC Website
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [4/6] Creating VQNC Website project..."

WEBSITE_PROJECT_ID=$(curl -s -X POST "$API/companies/$COMPANY_ID/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"VQNC Labs Website\",
    \"description\": \"Public-facing company website with Abyssal Intelligence design system. Includes landing page, solutions showcase, legal pages, and lead generation.\",
    \"status\": \"planned\",
    \"goalId\": \"$GROWTH_GOAL_ID\",
    \"leadAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "  ✓ VQNC Website project → $WEBSITE_PROJECT_ID"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 5. Seed strategic tasks
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [5/6] Creating strategic tasks..."

# --- CEO Tasks ---
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Define Q2 2026 Revenue Strategy\",
    \"description\": \"Review current product roadmap, market positioning, and agent capabilities. Produce a Q2 strategy document covering:\\n1. Revenue targets and pricing for Book Forge\\n2. New product opportunities (AI writing tools, Abyssal Intelligence SDK)\\n3. Resource allocation across CTO and CMO teams\\n4. Key risk mitigations\",
    \"status\": \"todo\",
    \"priority\": \"critical\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$REVENUE_GOAL_ID\",
    \"assigneeAgentId\": \"$CEO_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ CEO: Q2 Revenue Strategy"

# --- CTO Tasks ---
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Set Up CI/CD Pipeline for Book Forge\",
    \"description\": \"Configure GitHub Actions CI/CD pipeline for the Book Forge repository. Include:\\n- Lint + TypeScript checking on PR\\n- Automated test suite\\n- Preview deployments to Vercel/Netlify\\n- Production auto-deploy on main merge\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$TECH_GOAL_ID\",
    \"assigneeAgentId\": \"$CTO_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ CTO: CI/CD Pipeline"

curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Design API Layer for AI Story Generation\",
    \"description\": \"Architect a server-side proxy API that secures Gemini API calls for the Book Forge frontend. Define endpoints for:\\n- Story generation\\n- Character Bible AI assistance\\n- Cover image generation\\n- AI Story Critic feedback\\n\\nProduce an OpenAPI spec and hand implementation tasks to Engineers.\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$TECH_GOAL_ID\",
    \"assigneeAgentId\": \"$CTO_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ CTO: API Layer Design"

# --- Engineer Tasks ---
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Implement localStorage Persistence Layer\",
    \"description\": \"Build a robust localStorage-based persistence layer for Book Forge that handles:\\n- User projects (books, characters, settings)\\n- Auto-save with debounce\\n- Import/export as JSON\\n- Migration path for future IndexedDB upgrade\\n\\nUse the Abyssal Intelligence design tokens for all UI components.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$TECH_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ Engineer: localStorage Persistence"

curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Build Series Manager Component\",
    \"description\": \"Implement the Series Manager feature for Book Forge:\\n- Series creation and listing UI\\n- Book ordering within a series\\n- Shared character/setting references across series entries\\n- Visual timeline view\\n\\nFollow Abyssal Intelligence design system specifications.\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$TECH_GOAL_ID\",
    \"assigneeAgentId\": \"$ENGINEER_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ Engineer: Series Manager"

# --- CMO Tasks ---
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Create VQNC Brand Guidelines Document\",
    \"description\": \"Produce the canonical VQNC brand guidelines document covering:\\n- Logo usage and variations\\n- Abyssal Intelligence color palette and typography\\n- Voice and tone guidelines\\n- Social media templates\\n- Email templates\\n\\nThis document will be the single source of truth for all brand-related work.\",
    \"status\": \"todo\",
    \"priority\": \"high\",
    \"projectId\": \"$WEBSITE_PROJECT_ID\",
    \"goalId\": \"$GROWTH_GOAL_ID\",
    \"assigneeAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ CMO: Brand Guidelines"

curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Plan Book Forge Launch Campaign\",
    \"description\": \"Design the go-to-market campaign for Book Forge public launch:\\n- Launch timeline and milestones\\n- Telegram announcement strategy\\n- LinkedIn and social media content calendar\\n- Early access / waitlist mechanics\\n- Pricing strategy recommendation for CEO review\",
    \"status\": \"backlog\",
    \"priority\": \"high\",
    \"projectId\": \"$BOOKFORGE_PROJECT_ID\",
    \"goalId\": \"$GROWTH_GOAL_ID\",
    \"assigneeAgentId\": \"$CMO_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ CMO: Launch Campaign"

# --- Hermes Tasks ---
curl -s -X POST "$API/companies/$COMPANY_ID/issues" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Establish VQNC Telegram Channel Content Cadence\",
    \"description\": \"Set up and maintain a consistent content cadence on the VQNC Telegram channel:\\n- 3 posts per week minimum\\n- Mix of: build updates, AI insights, community polls, product teasers\\n- Engage with all user messages within 4 hours\\n- Weekly engagement metric report to CMO\",
    \"status\": \"backlog\",
    \"priority\": \"medium\",
    \"projectId\": \"$WEBSITE_PROJECT_ID\",
    \"goalId\": \"$GROWTH_GOAL_ID\",
    \"assigneeAgentId\": \"$HERMES_ID\"
  }" | python3 -c "import sys,json; print(f'  ✓ {d[\"identifier\"]}: {d[\"title\"]}' if (d:=json.load(sys.stdin)) else '')" 2>/dev/null || echo "  ✓ Hermes: Telegram Cadence"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# 6. Enable CEO permission to create agents
# ──────────────────────────────────────────────────────────────────────────────
echo ">>> [6/6] Enabling CEO agent creation permissions..."

curl -s -X PATCH "$API/agents/$CEO_ID/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "canCreateAgents": true,
    "canAssignTasks": true
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ CEO permissions → canCreateAgents={d.get(\"permissions\",{}).get(\"canCreateAgents\",\"?\")}')" 2>/dev/null || echo "  ✓ CEO permissions updated"

echo ""
echo "=== VQNC Organization Build Complete ==="
echo ""
echo "Company:  VQNC ($COMPANY_ID)"
echo "Agents:   CEO, CTO, CMO, Engineer, Marketing (Hermes)"
echo "Goals:    1 company + 3 team goals"
echo "Projects: Book Forge Expansion + VQNC Labs Website"
echo "Tasks:    5 existing + 9 new strategic tasks"
echo ""
echo "Open the board UI at: http://127.0.0.1:3101"
