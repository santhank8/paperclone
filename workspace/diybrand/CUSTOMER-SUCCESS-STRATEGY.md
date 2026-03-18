# Customer Success Strategy

**Goal:** Zero support tickets by having every customer question answered before they ask it.

---

## Philosophy

**Every support email is a failure in our documentation.**

If someone emails with a question, that question belongs in FAQ or guides. Our job is to build documentation so good that customers never need to email us.

---

## Core Pillars

### 1. FAQ Page (`/faq`)
- Searchable, categorized questions
- **9 categories:** Getting started, questionnaire, logo generation, colors & typography, exporting, using your brand, troubleshooting, pricing & refunds, privacy
- Covers every common question about the product
- Updated as we see new patterns in support

### 2. How-To Guides (`/guides`)
- Step-by-step instructions for every feature
- 6 comprehensive guides covering the full customer journey
- Designed for non-technical users
- Updated whenever product changes

### 3. Support Email Templates
- Professional, friendly response templates
- For common scenarios (refunds, technical issues, feature requests, etc.)
- Ensures consistency and empathy in every response
- Maintains our brand voice

### 4. Onboarding
- Welcome email with link to guides
- Quick-start checklist
- Links to FAQ for common questions

### 5. Feedback Collection
- Post-export survey (floating feedback form)
- Net Promoter Score (NPS) tracking
- Customer satisfaction metrics
- Used to identify gaps in documentation

---

## Key Metrics

| Metric | Target | Why It Matters |
|--------|--------|-----------------|
| Support tickets per month | < 10 | Indicates documentation quality |
| FAQ search usage | > 50% of visitors | Customers find answers themselves |
| Time-to-first-logo | < 5 min | Success metric from product |
| Customer satisfaction | > 4.5/5 stars | Feedback form rating |
| Refund rate | < 5% | Product satisfaction |
| Documentation update frequency | Weekly | Stays fresh with new issues |

---

## Workflow

### When a Support Email Arrives

1. **Respond** using SUPPORT-TEMPLATES.md
2. **Solve** the customer's problem
3. **Analyze** — Why did they need to email?
   - Is this in FAQ? → No? Add it.
   - Is this in guides? → No? Add it.
   - Is this confusing in the product? → Flag for product team.
4. **Update** FAQ/guides to prevent repeat emails
5. **Goal:** If 5 people have the same question, it's a documentation failure, not a support burden

### When Patterns Emerge

If you see the same question 3+ times:
1. Add to FAQ immediately
2. Create a guide if it's complex
3. Mention in next onboarding email
4. Consider product improvement

**Example:** "Color picker not working" → Document troubleshooting steps in FAQ + guides

---

## Documentation Standards

### FAQ
- ✅ Clear, direct answers
- ✅ No jargon (assume non-technical user)
- ✅ Bullet points for scannability
- ✅ Links to guides for deeper help
- ✅ Searchable categories

### Guides
- ✅ Step-by-step instructions
- ✅ Screenshots/visual aids where helpful
- ✅ Estimated time to complete
- ✅ Links to related resources
- ✅ "Still stuck?" CTA at bottom

### Email Templates
- ✅ Personalized with customer name
- ✅ Friendly, conversational tone
- ✅ Clear next steps
- ✅ Links to helpful resources
- ✅ Empathy + problem-solving

---

## Content Calendar

### Weekly
- Review support emails and FAQ
- Add any new questions to FAQ
- Update guides if product changed

### Bi-weekly
- Check feedback form responses
- Identify patterns in ratings/comments
- Plan new content based on feedback

### Monthly
- Analytics review: FAQ searches, guide views, support volume
- Update support templates based on new issues
- Audit for outdated information
- Plan next month's improvements

---

## Success Page Onboarding

After download, show:
```
🎉 Your brand kit is ready!

Next steps:
1. 📖 Read how-to guides → [/guides](https://diybrand.app/guides)
2. ❓ Check FAQ for quick answers → [/faq](https://diybrand.app/faq)
3. 💬 Questions? Email support@diybrand.app

You've got everything you need. Go build something amazing.
```

---

## Feedback Loop

```
Customer uses product
         ↓
Exports brand
         ↓
Sees feedback form (bottom right)
         ↓
Submits rating + comment
         ↓
Echo reviews feedback
         ↓
Updates FAQ/guides based on feedback
         ↓
Product improves
         ↓
Fewer support emails
```

---

## Red Flags (Update Docs When You See These)

- Customer confused about what a feature does? → Add to guides
- Technical issue with color picker? → Troubleshooting guide
- Customer doesn't understand file formats? → Export formats guide
- Refund request without trying alternatives? → Maybe onboarding needs improvement
- Same question asked twice? → Add to FAQ

---

## Tools & Access

- **FAQ page:** `/src/app/faq/page.tsx`
- **Guides:** `/src/app/guides/page.tsx`
- **Email templates:** `SUPPORT-TEMPLATES.md`
- **Strategy:** This file
- **Feedback form:** `/src/components/FeedbackForm.tsx`
- **Feedback API:** `/src/app/api/feedback/route.ts` (create as needed)

---

## The Goal

**Making a support ticket impossible because the answer is so obvious, it's impossible to have a question.**

This is where we win. Not by responding to emails, but by making sure customers never need to send them.

---

## Success Stories to Track

As we grow, note:
- "Customer regenerated 5 times and loved the final brand" → Success
- "Customer couldn't find something and emailed" → Failure (update docs)
- "Feedback score 5/5" → Success
- "Customer refunded" → Investigate why
- "No support emails this week" → We're winning

---

## Updating This Document

As we learn:
1. What questions are most common?
2. What's confusing about the product?
3. What should be explained differently?
4. What's working in FAQ/guides?
5. What metrics matter most?

Keep this document living. Update weekly based on learnings.

**Owner:** Echo (Customer Success Lead)
**Last updated:** 2026-03-18
