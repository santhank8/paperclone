---
name: design-guide
description: >
  Outpost UI design system guide for building consistent, reusable frontend
  components. Use when creating new UI components, modifying existing ones,
  adding pages or features to the frontend, styling UI elements, or when you
  need to understand the design language and conventions. Covers: component
  creation, design tokens, typography, status/priority systems, composition
  patterns, content width modes, and the /design-guide showcase page. Always
  use this skill alongside the frontend-design skill (for visual quality) and
  the web-design-guidelines skill (for web best practices).
---

# Outpost Design Guide

Outpost's UI is a signal-station-inspired command post for AI agent orchestration — dense, keyboard-driven, dark-themed by default. Warm amber accents over deep charcoal surfaces. Every pixel earns its place.

**Always use with:** `frontend-design` (visual polish) and `web-design-guidelines` (web best practices).

---

## 1. Design Principles

- **Dense but scannable.** Maximum information without clicks to reveal. Whitespace separates, not pads.
- **Keyboard-first.** Global shortcuts (Cmd+K, C, [, ], \). Power users rarely touch the mouse.
- **Contextual, not modal.** Inline editing over dialog boxes. Dropdowns over page navigations.
- **Dark theme default.** Deep charcoal backgrounds (OKLCH hue ~265), warm amber primary accent (OKLCH hue ~70). Text is the primary visual element.
- **Signal station aesthetic.** Warm amber glow for active/live elements. Subtle topographic/radar-inspired textures on ambient surfaces. Clean geometric iconography.
- **Component-driven.** Prefer reusable components that capture style conventions. Build at the right abstraction — not too granular, not too monolithic.
- **Zero border radius.** All `--radius` values are 0. Corners are sharp. This is deliberate — the design language is utilitarian, not soft.

---

## 2. Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4** with CSS variables (OKLCH color space)
- **shadcn/ui** (new-york style, neutral base, CSS variables enabled)
- **Radix UI** primitives (accessibility, focus management)
- **Lucide React** icons (16px nav, 14px inline)
- **class-variance-authority** (CVA) for component variants
- **clsx + tailwind-merge** via `cn()` utility

Config: `ui/components.json` (aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`)

---

## 3. Design Tokens

All tokens defined as CSS variables in `ui/src/index.css`. Both light and dark themes use OKLCH.

### Colors

Use semantic token names, never raw color values:

| Token | Usage |
|-------|-------|
| `--background` / `--foreground` | Page background and primary text |
| `--card` / `--card-foreground` | Card surfaces |
| `--primary` / `--primary-foreground` | Primary actions, emphasis — warm amber in dark mode (`oklch(0.78 0.155 70)`), deeper amber in light (`oklch(0.62 0.19 65)`) |
| `--secondary` / `--secondary-foreground` | Secondary surfaces |
| `--muted` / `--muted-foreground` | Subdued text, labels |
| `--accent` / `--accent-foreground` | Hover states, active nav items |
| `--destructive` | Destructive actions |
| `--border` | All borders |
| `--ring` | Focus rings — matches `--primary` |
| `--sidebar-*` | Sidebar-specific variants |
| `--chart-1` through `--chart-5` | Data visualization (chart-1 = amber/primary) |

### Dark Theme Palette (default)

- Background: `oklch(0.155 0.012 265)` — deep cool charcoal
- Foreground: `oklch(0.93 0.01 85)` — warm off-white
- Primary: `oklch(0.78 0.155 70)` — warm amber
- Border: `oklch(0.28 0.012 265)` — subtle cool gray
- Card: `oklch(0.19 0.012 265)` — slightly elevated surface

### Light Theme Palette

- Background: `oklch(0.97 0.005 85)` — warm paper white
- Foreground: `oklch(0.16 0.015 260)` — near black
- Primary: `oklch(0.62 0.19 65)` — deep amber
- Border: `oklch(0.88 0.01 85)` — soft warm gray

### Radius

All radii are set to `0` by default. The design is deliberately sharp-cornered and utilitarian:

- `--radius-sm`: 0.375rem
- `--radius-md`: 0.5rem
- `--radius-lg`: 0px
- `--radius-xl`: 0px
- `--radius` (base): 0

Exception: `rounded-full` for badges, avatars, status dots, and pills.

### Shadows

Minimal shadows: `shadow-xs` (outline buttons), `shadow-sm` (cards). No heavy shadows. For emphasis, prefer amber glow effects: `hover:shadow-[0_0_12px_oklch(0.78_0.155_70/0.08)]`.

---

## 4. Typography

Three font families, loaded from Google Fonts:

| Family | CSS Variable | Usage |
|--------|-------------|-------|
| **Bricolage Grotesque** | `--font-family-display` | Headings (h1–h3), brand text, page titles, section labels, metric values, breadcrumbs |
| **Outfit** | `--font-family-body` | Body text, UI controls, form elements, descriptions |
| **JetBrains Mono** | `--font-family-mono` | Code, issue keys, CSS vars, log output, monospaced data |

### Typography Scale

Use these exact patterns — do not invent new ones:

| Pattern | Classes | Font | Usage |
|---------|---------|------|-------|
| Page title | `text-sm font-semibold uppercase tracking-wider` | Display | BreadcrumbBar single-crumb, rendered via `style={{ fontFamily: "var(--font-family-display)" }}` |
| Section title | `text-lg font-semibold` | Display (inherits from h2) | Major sections |
| Section heading | `text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60` | Display | Sidebar section headers |
| Card title | `text-sm font-medium` or `text-sm font-semibold` | Body | Card headers, list item titles |
| Body | `text-sm` | Body | Default body text |
| Muted | `text-sm text-muted-foreground` | Body | Descriptions, secondary text |
| Tiny label | `text-xs text-muted-foreground` | Body | Metadata, timestamps, property labels |
| Mono identifier | `text-xs font-mono text-muted-foreground` | Mono | Issue keys (COM-001), CSS vars |
| Large stat | `text-2xl sm:text-3xl font-bold tracking-tight tabular-nums` | Display | Dashboard metric values in MetricCard |
| Code/log | `font-mono text-xs` | Mono | Log output, code snippets |
| Brand text | `text-sm font-semibold tracking-wide` | Display | Outpost brand name in sidebar/auth |

---

## 5. Brand Identity

### OutpostMark

**File:** `ui/src/components/OutpostMark.tsx`
**Props:** `className`, `size` (default 24), `glow` (boolean)

The brand mark is a signal-beacon SVG with concentric arcs, directional rays, and a central dot. Use it:
- In the CompanyRail header (22px, `text-primary`, glow on hover)
- On the Auth page (20px with brand text, 48px overlay on animation)
- As favicon (see `ui/public/favicon.svg`)

The `glow` prop adds `drop-shadow-[0_0_8px_oklch(0.78_0.155_70/0.5)]`.

### Favicon

SVG favicon at `ui/public/favicon.svg` uses `prefers-color-scheme` media query:
- Light: charcoal strokes (`#1a1a2e`)
- Dark: warm off-white strokes (`#e8dcc8`) with amber fill (`#d4a054`)

---

## 6. Status & Priority Systems

### Status Colors (consistent across all entities)

Defined in `ui/src/lib/status-colors.ts`, consumed by `StatusBadge.tsx` and `StatusIcon.tsx`:

| Status | Color | Entity types |
|--------|-------|-------------|
| active, achieved, completed, succeeded, approved, done | Green shades | Agents, goals, issues, approvals |
| running | Primary amber (dot), Cyan (badge) | Agents |
| paused | Orange | Agents |
| idle, pending | Yellow | Agents, approvals |
| failed, error, rejected, blocked | Red shades | Runs, agents, approvals, issues |
| archived, planned, backlog, cancelled | Neutral gray | Various |
| todo | Blue | Issues |
| in_progress | Yellow | Issues |
| in_review | Violet | Issues |

### Priority Icons

Defined in `PriorityIcon.tsx`: critical (red/AlertTriangle), high (orange/ArrowUp), medium (yellow/Minus), low (blue/ArrowDown).

### Agent Status Dots

Inline colored dots defined in `status-colors.ts`:
- running: `bg-primary animate-pulse-amber` (amber pulsing glow)
- active: `bg-green-400`
- paused: `bg-yellow-400`
- error: `bg-red-400`
- offline: `bg-neutral-400`

---

## 7. Animation System

All animations defined in `ui/src/index.css`. Respect `prefers-reduced-motion`.

| Animation | Class | Usage |
|-----------|-------|-------|
| Page entrance | `animate-page-enter` | Applied to outermost div of every page component. 280ms fade+slide-up. |
| Staggered list | `animate-stagger-in` | Form elements, list items. 350ms with per-item `animationDelay`. |
| Amber shimmer | `animate-shimmer-amber` | Skeleton loading states. Warm amber highlight sweep. |
| Amber pulse | `animate-pulse-amber` | Live agent indicators. 2s pulsing glow ring. |
| Activity row enter | `activity-row-enter` | Dashboard live activity feed. 520ms slide+blur with amber highlight. |

### Hover Effects

Amber glow on interactive surfaces:
- MetricCards: `hover:border-primary/30 hover:shadow-[0_0_12px_oklch(0.78_0.155_70/0.08)]`
- Brand mark: `group-hover/mark:drop-shadow-[0_0_8px_oklch(0.78_0.155_70/0.45)]`
- Sidebar active: `before:` pseudo-element — 2px amber bar on left edge

---

## 8. Component Hierarchy

Three tiers:

1. **shadcn/ui primitives** (`ui/src/components/ui/`) — Button, Card, Input, Badge, Dialog, Tabs, etc. Do not modify these directly; extend via composition.
2. **Custom composites** (`ui/src/components/`) — StatusBadge, EntityRow, MetricCard, OutpostMark, etc. These capture Outpost-specific design language.
3. **Page components** (`ui/src/pages/`) — Compose primitives and composites into full views.

**See [references/component-index.md](references/component-index.md) for the complete component inventory with usage guidance.**

### When to Create a New Component

Create a reusable component when:
- The same visual pattern appears in 2+ places
- The pattern has interactive behavior (status changing, inline editing)
- The pattern encodes domain logic (status colors, priority icons)

Do NOT create a component for:
- One-off layouts specific to a single page
- Simple className combinations (use Tailwind directly)
- Thin wrappers that add no semantic value

---

## 9. Composition Patterns

These patterns describe how components work together. They may not be their own component, but they must be used consistently across the app.

### Entity Row with Status + Priority

The standard list item for issues and similar entities:

```tsx
<EntityRow
  leading={<><StatusIcon status="in_progress" /><PriorityIcon priority="high" /></>}
  identifier="COM-001"
  title="Implement authentication flow"
  subtitle="Assigned to Agent Alpha"
  trailing={<StatusBadge status="in_progress" />}
  onClick={() => {}}
/>
```

Leading slot always: StatusIcon first, then PriorityIcon. Trailing slot: StatusBadge or timestamp.

### Grouped List

Issues grouped by status header + entity rows:

```tsx
<div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
  <StatusIcon status="in_progress" />
  <span className="text-sm font-medium">In Progress</span>
  <span className="text-xs text-muted-foreground ml-1">2</span>
</div>
<div className="border border-border">
  <EntityRow ... />
  <EntityRow ... />
</div>
```

### Property Row

Key-value pairs in properties panels:

```tsx
<div className="flex items-center justify-between py-1.5">
  <span className="text-xs text-muted-foreground">Status</span>
  <StatusBadge status="active" />
</div>
```

Label is always `text-xs text-muted-foreground`, value on the right. Wrap in a container with `space-y-1`.

### Metric Card Grid

Dashboard metrics in a responsive grid:

```tsx
<div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
  <MetricCard icon={Bot} value={12} label="Active Agents" description="+3 this week" />
  ...
</div>
```

MetricCard features:
- Value uses display font (`--font-family-display`)
- Icon container: `bg-primary/8 text-primary/70`
- Hover: `hover:border-primary/30 hover:shadow-[0_0_12px_oklch(0.78_0.155_70/0.08)]`

### Progress Bar (Budget)

Color by threshold: green (<60%), yellow (60-85%), red (>85%):

```tsx
<div className="w-full h-2 bg-muted overflow-hidden">
  <div className="h-full bg-green-400" style={{ width: `${pct}%` }} />
</div>
```

### Comment Thread

Author header (name + timestamp) then body, in bordered cards with `space-y-3`. Add comment textarea + button below.

### Cost Table

Standard `<table>` with `text-xs`, header row with `bg-accent/20`, `font-mono` for numeric values.

### Log Viewer

`bg-neutral-950 p-3 font-mono text-xs` container. Color lines by level: default (foreground), WARN (yellow-400), ERROR (red-400), SYS (blue-300). Include live indicator dot when streaming.

---

## 10. Interactive Patterns

### Hover States

- Entity rows: `hover:bg-accent/50`
- Nav items: `hover:bg-accent/50 hover:text-foreground`
- Active nav: 2px amber bar left edge via `before:` pseudo-element (`before:bg-primary`)
- Cards/surfaces: `hover:border-primary/30` with optional amber glow shadow

### Focus

`focus-visible:ring-ring focus-visible:ring-[3px]` — standard Tailwind focus-visible ring. Ring color matches primary (amber).

### Disabled

`disabled:opacity-50 disabled:pointer-events-none`

### Inline Editing

Use `InlineEditor` component — click text to edit, Enter saves, Escape cancels.

### Popover Selectors

StatusIcon and PriorityIcon use Radix Popover for inline selection. Follow this pattern for any clickable property that opens a picker.

---

## 11. Layout System

Four-zone layout defined in `Layout.tsx`:

```
┌────────┬──────────┬──────────────────────────────┬──────────────────────┐
│Company │ Sidebar  │  Breadcrumb bar  [width ⇔]   │                      │
│ Rail   │ (w-60)   ├──────────────────────────────┤  Properties panel    │
│(w-[72])│          │  Main content (flex-1)       │  (w-80, optional)    │
│        │          │  ┌─ max-w-[1100px] ─┐        │                      │
│        │          │  │ (focused mode)    │        │                      │
│        │          │  └──────────────────┘        │                      │
└────────┴──────────┴──────────────────────────────┴──────────────────────┘
```

- **Company rail**: `w-[72px]`, always visible, brand mark at top, company avatars
- **Sidebar**: `w-60`, collapsible (`[` shortcut), contains search, nav items, project/agent lists
- **Properties panel**: `w-80`, shown on detail views, hidden on lists (`]` shortcut)
- **Main content**: scrollable, `flex-1`

### Content Width Modes

Toggle between focused and full-width display (`\` shortcut, or button in breadcrumb bar):

| Mode | Behavior | Use case |
|------|----------|----------|
| **Focused** (default) | `max-w-[1100px] mx-auto` | Reading-friendly centered content with margins on wide screens |
| **Full** | No max-width constraint | Data-heavy views, kanban boards, wide tables |

Preference persists in `localStorage` under `outpost.contentWidth`.

The `useContentWidth()` hook (exported from `Layout.tsx`) provides `{ contentWidth, toggleContentWidth }` to any child component that needs to react to or control the mode.

---

## 12. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` | Open command palette |
| `C` | New issue |
| `[` | Toggle sidebar |
| `]` | Toggle properties panel |
| `\` | Toggle content width (focused ↔ full) |
| `Cmd+1..9` | Switch company |

Shortcuts are disabled when focus is in an input, textarea, or contenteditable element.

---

## 13. The /design-guide Page

**Location:** `ui/src/pages/DesignGuide.tsx`
**Route:** `/design-guide`

This is the living showcase of every component and pattern in the app. It is the source of truth for how things look.

### Rules

1. **When you add a new reusable component, you MUST add it to the design guide page.** Show all variants, sizes, and states.
2. **When you modify an existing component's API, update its design guide section.**
3. **When you add a new composition pattern, add a section demonstrating it.**
4. Follow the existing structure: `<Section title="...">` wrapper with `<SubSection>` for grouping.
5. Keep sections ordered logically: foundational (colors, typography) first, then primitives, then composites, then patterns.

### Adding a New Section

```tsx
<Section title="My New Component">
  <SubSection title="Variants">
    {/* Show all variants */}
  </SubSection>
  <SubSection title="Sizes">
    {/* Show all sizes */}
  </SubSection>
  <SubSection title="States">
    {/* Show interactive/disabled states */}
  </SubSection>
</Section>
```

---

## 14. Component Index

**See [references/component-index.md](references/component-index.md) for the full component inventory.**

When you create a new reusable component:
1. Add it to the component index reference file
2. Add it to the /design-guide page
3. Follow existing naming and file conventions

---

## 15. File Conventions

- **shadcn primitives:** `ui/src/components/ui/{component}.tsx` — lowercase, kebab-case
- **Custom components:** `ui/src/components/{ComponentName}.tsx` — PascalCase
- **Pages:** `ui/src/pages/{PageName}.tsx` — PascalCase
- **Utilities:** `ui/src/lib/{name}.ts`
- **Hooks:** `ui/src/hooks/{useName}.ts`
- **API modules:** `ui/src/api/{entity}.ts`
- **Context providers:** `ui/src/context/{Name}Context.tsx`
- **CSS class prefixes:** Use `outpost-` prefix for custom CSS classes (e.g., `outpost-mdxeditor`, `outpost-markdown`, `outpost-mermaid`)

All components use `cn()` from `@/lib/utils` for className merging. All components use CVA for variant definitions when they have multiple visual variants.

---

## 16. Common Mistakes to Avoid

- Using raw hex/rgb colors instead of CSS variable tokens
- Creating ad-hoc typography styles instead of using the established scale
- Using fonts other than Bricolage Grotesque (display), Outfit (body), or JetBrains Mono (mono)
- Hardcoding status colors instead of using StatusBadge/StatusIcon
- Building one-off styled elements when a reusable component exists
- Adding components without updating the design guide page
- Using `shadow-md` or heavier — keep shadows minimal (xs, sm only), prefer amber glow effects
- Using `rounded-lg` or `rounded-xl` — all radii are 0 except `rounded-full` for pills
- Forgetting dark mode — always use semantic tokens, never hardcode light/dark values
- Using `animate-pulse` instead of `animate-pulse-amber` for live indicators
- Using blue/cyan for active/running states where amber/primary is the correct accent
- Referencing "Paperclip" in user-facing text — the product name is "Outpost"
- Using `paperclip-*` CSS class prefixes — use `outpost-*` instead
