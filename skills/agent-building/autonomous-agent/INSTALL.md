# Install: Autonomous Agent

## Phase 1: Prerequisites Check
- [ ] Claude Code installed and running

## Phase 2: Configuration
Set up the following hooks in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [{ "hooks": [{ "type": "command", "command": "/abs/path/to/hook.sh" }] }]
    "PostToolUse": [{ "hooks": [{ "type": "command", "command": "/abs/path/to/hook.sh" }] }]
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "/abs/path/to/hook.sh" }] }]
    "Stop": [{ "hooks": [{ "type": "command", "command": "/abs/path/to/hook.sh" }] }]
  }
}
```

**Critical:** Use absolute paths in hook commands. Relative paths silently fail.

Choose your preferred defaults:
- Create `~/.claude/skill-customizations/autonomous-agent/PREFERENCES.md` with your choices (see Phase 4)

## Phase 3: Installation
Copy skill files to your Claude Code skills directory:

```bash
# Create skill directory
mkdir -p ~/.claude/skills/autonomous-agent/references

# Copy SKILL.md
cp SKILL.md ~/.claude/skills/autonomous-agent/SKILL.md

# Copy reference files
cp references/hooks.md ~/.claude/skills/autonomous-agent/references/hooks.md
cp references/self-improving-example.md ~/.claude/skills/autonomous-agent/references/self-improving-example.md
```

## Phase 4: Customization (Optional)
Create a customization file to override defaults:
```bash
mkdir -p ~/.claude/skill-customizations/autonomous-agent
cat > ~/.claude/skill-customizations/autonomous-agent/PREFERENCES.md << 'EOF'
# Skill Customization: autonomous-agent
# Add your preferences below
EOF
```

## Phase 5: Verify Installation
Run the verification checklist: see VERIFY.md
