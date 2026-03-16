# Tools

## Paperclip Skill
Primary coordination tool. Use for all API calls to the Paperclip control plane.

## Skill Testing via `/skill-magic`
Your primary verification tool for skill reviews. Invoke `/skill-magic` in **Phase 2 (Test)** mode:
- Point it at the SKILL.md under review
- Run trigger tests: does the skill fire on intended prompts?
- Run output tests: does the output match documented behavior?
- Get a pass/fail table with scores

Use Phase 2 results as objective evidence in your review comments. If a skill fails >20% of trigger tests, it's an automatic rejection.

## File System Tools
Read deliverables for review:
- Read SKILL.md files, tutorials, scripts, and video assets
- Read the original issue/brief to compare against requirements
- Check file organization matches the expected structure

## Web Search & WebFetch
Verify claims and check competitive quality:
- Search for the tool/API the skill covers to verify accuracy
- Fetch official docs to compare against tutorial instructions
- Check if examples use current API versions (not deprecated)

## Browser Tools (Chrome CDP)
Test web features when reviewing website changes:
- Load preview deployments at the Vercel URL
- Test at 375px (mobile), 768px (tablet), 1280px (desktop)
- Check interactive elements, hover states, focus rings
- Verify accessibility: keyboard navigation, ARIA labels
- Take screenshots as evidence for review comments

## Notes
- Always use the Paperclip skill for API calls — do not use raw curl/fetch.
- Always include `X-Paperclip-Run-Id` header on mutating calls.
- Approval and rejection comments must be specific and numbered. Vague feedback is not acceptable.
- Every rejection must include: what failed, why it matters, and what would make it pass.
- Every approval must note what was tested and the test results. "Looks good" is not a review.
