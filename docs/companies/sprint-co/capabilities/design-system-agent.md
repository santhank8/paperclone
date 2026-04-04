# Design System Agent

> Sprint Co Capability — Phase 11: Advanced Agent Capabilities

## Purpose

Ensure visual and interaction consistency across sprints and features. The Design System Agent acts as a guardian of the product's UI language, catching deviations before they reach users.

## Responsibilities

| Responsibility | Frequency | Output |
|---------------|-----------|--------|
| Maintain component library documentation | Every sprint | Updated component catalog |
| Review UI changes for consistency | Every frontend handoff | Consistency report |
| Propose design tokens | When patterns emerge | Token proposal artifact |
| Flag deviations from established patterns | During QA | Deviation alerts |
| Track design debt | End of sprint | Design debt log |

## Design Token Registry Template

The Design System Agent maintains and enforces the following token registry:

```yaml
# design-tokens.yaml
version: "<sprint-version>"
last_updated: "<YYYY-MM-DD>"

colors:
  primary:
    50: "#EFF6FF"
    100: "#DBEAFE"
    500: "#3B82F6"
    600: "#2563EB"
    900: "#1E3A5F"
  neutral:
    0: "#FFFFFF"
    50: "#F9FAFB"
    100: "#F3F4F6"
    500: "#6B7280"
    900: "#111827"
  semantic:
    success: "#10B981"
    warning: "#F59E0B"
    error: "#EF4444"
    info: "#3B82F6"

typography:
  font_family:
    primary: "Inter, system-ui, sans-serif"
    mono: "JetBrains Mono, monospace"
  font_size:
    xs: "0.75rem"    # 12px
    sm: "0.875rem"   # 14px
    base: "1rem"     # 16px
    lg: "1.125rem"   # 18px
    xl: "1.25rem"    # 20px
    2xl: "1.5rem"    # 24px
    3xl: "1.875rem"  # 30px
  font_weight:
    normal: 400
    medium: 500
    semibold: 600
    bold: 700
  line_height:
    tight: 1.25
    normal: 1.5
    relaxed: 1.75

spacing:
  unit: "4px"
  scale:
    0: "0"
    1: "4px"
    2: "8px"
    3: "12px"
    4: "16px"
    6: "24px"
    8: "32px"
    12: "48px"
    16: "64px"

breakpoints:
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"

shadows:
  sm: "0 1px 2px rgba(0,0,0,0.05)"
  md: "0 4px 6px rgba(0,0,0,0.1)"
  lg: "0 10px 15px rgba(0,0,0,0.1)"
  xl: "0 20px 25px rgba(0,0,0,0.15)"

animations:
  duration:
    fast: "150ms"
    normal: "300ms"
    slow: "500ms"
  easing:
    default: "cubic-bezier(0.4, 0, 0.2, 1)"
    in: "cubic-bezier(0.4, 0, 1, 1)"
    out: "cubic-bezier(0, 0, 0.2, 1)"

border_radius:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
```

## Component Catalog Template

For each component in the design system:

```markdown
## Component: <Name>

**Status:** [stable | beta | deprecated]
**Last Updated:** <YYYY-MM-DD>

### Usage
<When and why to use this component>

### Variants
| Variant | Description | Use When |
|---------|-------------|----------|
| default | Standard appearance | Most cases |
| outline | Border only, no fill | Secondary actions |
| ghost | No border or fill | Tertiary actions |

### Props / API
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| size | sm / md / lg | md | Component size |
| variant | default / outline / ghost | default | Visual style |
| disabled | boolean | false | Disable interaction |

### Do
- Use for <intended purpose>
- Combine with <compatible components>
- Maintain minimum touch target of 44px

### Don't
- Don't use for <misuse case>
- Don't nest inside <incompatible component>
- Don't override token values inline

### Accessibility
- Keyboard navigation: <yes/no + details>
- Screen reader: <aria labels>
- Color contrast: <WCAG level>

### Examples
<Code snippets or references to working examples>
```

## Consistency Scoring

The Design System Agent grades every frontend feature on consistency:

| Criterion | Weight | Score Range | Description |
|-----------|--------|-------------|-------------|
| Token adherence | 30% | 0–5 | Are design tokens used (not hardcoded values)? |
| Component reuse | 25% | 0–5 | Are existing components used (not one-off implementations)? |
| Pattern consistency | 20% | 0–5 | Does the layout/interaction match established patterns? |
| Responsive behavior | 15% | 0–5 | Does it work across breakpoints using defined breakpoints? |
| Accessibility | 10% | 0–5 | Does it meet accessibility requirements? |

**Overall Score:** Weighted average, reported as 0–5.

| Score | Grade | Action |
|-------|-------|--------|
| 4.5–5.0 | A | Ship |
| 3.5–4.4 | B | Ship with minor fixes noted |
| 2.5–3.4 | C | Fix before shipping |
| 1.5–2.4 | D | Significant rework needed |
| 0–1.4 | F | Reject — does not meet standards |

## Consistency Report Template

```markdown
# Design Consistency Report

- **Feature:** <feature-name>
- **Sprint:** <sprint-id>
- **Reviewed By:** Design System Agent
- **Date:** <YYYY-MM-DD>

## Scores
| Criterion | Score | Notes |
|-----------|-------|-------|
| Token adherence | X/5 | |
| Component reuse | X/5 | |
| Pattern consistency | X/5 | |
| Responsive behavior | X/5 | |
| Accessibility | X/5 | |
| **Overall** | **X/5** | **Grade: X** |

## Deviations Found
1. <file:line> — <description of deviation>
2. ...

## Recommendations
1. <what to fix and how>
2. ...

## New Patterns Proposed
- <if the feature introduces a pattern worth standardizing>
```

## Integration

The Design System Agent reviews **every frontend handoff before QA**:

```
Engineer completes frontend task
  → Handoff artifact created
    → Design System Agent reviews for consistency
      → Consistency report attached to task
        → If grade ≥ B: proceed to QA
        → If grade < B: return to Engineer with deviation list
          → Engineer fixes → re-review
            → QA
```

The Design System Agent does not block non-frontend tasks and has no authority over backend or infrastructure work.
