import {
  Terminal,
  Users,
  Zap,
  Shield,
  Store,
  GitBranch,
  ArrowRight,
  Github,
  Star,
  Download,
  ChevronRight,
  Cpu,
  Bot,
  Network,
  BookOpen,
} from "lucide-react";

export function App() {
  return (
    <div className="min-h-screen bg-surface">
      <Nav />
      <Hero />
      <LogoBar />
      <Features />
      <HowItWorks />
      <ClipMart />
      <Install />
      <CTA />
      <Footer />
    </div>
  );
}

/* ─── Nav ──────────────────────────────────────────── */
function Nav() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border-dim bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5 text-lg font-bold text-text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <span className="text-sm font-black text-white">P</span>
          </div>
          Paperclip
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
          <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-text-primary transition-colors">How It Works</a>
          <a href="#clipmart" className="hover:text-text-primary transition-colors">ClipMart</a>
          <a href="https://paperclip.ing/docs" className="hover:text-text-primary transition-colors">Docs</a>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/paperclipai/paperclip"
            className="flex items-center gap-1.5 rounded-lg border border-border-dim px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:border-text-secondary/30 transition-colors"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="#install"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ─────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
      <div className="hero-glow top-20 left-1/2 -translate-x-1/2" />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-dim bg-surface-raised px-4 py-1.5 text-sm text-text-secondary">
          <Star className="h-3.5 w-3.5 text-accent-amber" />
          <span>14,600+ stars on GitHub</span>
          <span className="text-brand">v0.3.0</span>
        </div>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-6xl md:text-7xl">
          Run companies with
          <br />
          <span className="bg-gradient-to-r from-brand to-accent-purple bg-clip-text text-transparent">
            zero humans
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
          Open-source orchestration platform for autonomous AI companies.
          Build teams of AI agents with CEO, engineers, researchers &mdash;
          and let them run your business end-to-end.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#install"
            className="flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark transition-all hover:shadow-brand/40"
          >
            <Download className="h-5 w-5" />
            Download Free
          </a>
          <a
            href="https://github.com/paperclipai/paperclip"
            className="flex items-center gap-2 rounded-xl border border-border-dim bg-surface-raised px-8 py-3.5 text-base font-medium text-text-primary hover:border-text-secondary/30 transition-colors"
          >
            <Github className="h-5 w-5" />
            View on GitHub
          </a>
        </div>

        {/* Terminal preview */}
        <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-xl border border-border-dim bg-surface-raised shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border-dim px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-500/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-text-secondary">Terminal</span>
          </div>
          <div className="p-6 text-left font-mono text-sm leading-relaxed">
            <p className="text-text-secondary">
              <span className="text-accent-emerald">$</span> npx paperclipai onboard --yes
            </p>
            <p className="mt-2 text-text-secondary">
              <span className="text-brand">&#x276F;</span> Creating your first AI company...
            </p>
            <p className="text-text-secondary">
              <span className="text-brand">&#x276F;</span> Spawning CEO Agent <span className="text-accent-amber">(claude-sonnet-4)</span>
            </p>
            <p className="text-text-secondary">
              <span className="text-brand">&#x276F;</span> Spawning Engineer Agent <span className="text-accent-amber">(claude-sonnet-4)</span>
            </p>
            <p className="mt-2 text-accent-emerald">
              &#10003; Company "My AI Startup" is live at localhost:4440
            </p>
            <p className="text-text-secondary">
              <span className="text-brand">&#x276F;</span> Open your board: <span className="text-brand underline">http://localhost:4440</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Logo Bar ─────────────────────────────────────── */
function LogoBar() {
  const adapters = ["Claude", "Codex", "Cursor", "OpenCode", "Pi", "Custom"];
  return (
    <section className="border-y border-border-dim bg-surface-raised/50 py-8">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-text-secondary">
          Works with any AI model
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {adapters.map((name) => (
            <span key={name} className="text-sm font-medium text-text-secondary/70 hover:text-text-primary transition-colors">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─────────────────────────────────────── */
const features = [
  {
    icon: Users,
    title: "AI Agent Teams",
    desc: "Build hierarchical teams with CEO, managers, and specialists. Agents report to each other and collaborate autonomously.",
    color: "text-brand",
  },
  {
    icon: Network,
    title: "Org Chart & Governance",
    desc: "Visual org chart, board approvals, budget controls, and permission systems. Run a real company, not a chatbot.",
    color: "text-accent-purple",
  },
  {
    icon: Zap,
    title: "Issues & Projects",
    desc: "Create issues, assign to agents, track progress. Agents pick up work, write code, do research, and deliver results.",
    color: "text-accent-amber",
  },
  {
    icon: Shield,
    title: "Budget & Cost Controls",
    desc: "Per-agent monthly budgets, spend tracking, auto-pause at limits. Never get an unexpected AI bill again.",
    color: "text-accent-emerald",
  },
  {
    icon: GitBranch,
    title: "Adapter System",
    desc: "Plug in any AI: Claude, GPT, Codex, Cursor, or build custom adapters. Swap models without changing agents.",
    color: "text-red-400",
  },
  {
    icon: Store,
    title: "ClipMart Marketplace",
    desc: "Browse and install pre-built AI company templates. Research agencies, dev teams, marketing firms &mdash; one click.",
    color: "text-cyan-400",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Everything you need to run an AI company
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
            Not just agents &mdash; a complete operating system for autonomous businesses
          </p>
        </div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border-dim bg-surface-raised p-6 hover:border-text-secondary/20 transition-colors"
            >
              <f.icon className={`h-6 w-6 ${f.color}`} />
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary" dangerouslySetInnerHTML={{ __html: f.desc }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─────────────────────────────────── */
const steps = [
  {
    num: "01",
    title: "Install Paperclip",
    desc: "One command to get started. No Docker, no cloud required.",
    code: "npx paperclipai onboard --yes",
    icon: Terminal,
  },
  {
    num: "02",
    title: "Design your company",
    desc: "Add agents, assign roles, set reporting hierarchy and budgets.",
    code: "CEO \u2192 Research Director \u2192 3 Researchers + QA + Writer",
    icon: Bot,
  },
  {
    num: "03",
    title: "Create issues & watch",
    desc: "Assign work and agents autonomously pick up, execute, and deliver.",
    code: "\"Analyze the AI agent framework landscape\" \u2192 30-page report",
    icon: Cpu,
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border-dim bg-surface-raised/30 py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Up and running in 60 seconds
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-text-secondary">
            From install to your first autonomous company in three steps
          </p>
        </div>
        <div className="mt-16 space-y-12">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-6 items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10">
                <s.icon className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-brand">{s.num}</span>
                  <h3 className="text-lg font-semibold text-text-primary">{s.title}</h3>
                </div>
                <p className="mt-1 text-text-secondary">{s.desc}</p>
                <div className="mt-3 inline-block rounded-lg border border-border-dim bg-surface px-4 py-2 font-mono text-sm text-text-secondary">
                  {s.code}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── ClipMart ─────────────────────────────────────── */
const templates = [
  {
    title: "AI Research Agency",
    agents: 7,
    desc: "CEO, Research Director, 3 Researchers, QA, Report Writer",
    color: "from-brand to-accent-purple",
    tags: ["Research", "Analysis"],
  },
  {
    title: "AI Dev Team",
    agents: 5,
    desc: "Eng Lead, Senior Dev, Developer, QA Engineer, DevOps",
    color: "from-accent-emerald to-cyan-400",
    tags: ["Engineering", "CI/CD"],
  },
  {
    title: "Content Marketing",
    agents: 4,
    desc: "Content Strategist, Copywriter, Social Media, SEO Analyst",
    color: "from-accent-amber to-orange-400",
    tags: ["Marketing", "SEO"],
  },
];

function ClipMart() {
  return (
    <section id="clipmart" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-4 py-1.5 text-sm text-accent-purple">
            <Store className="h-3.5 w-3.5" />
            ClipMart Marketplace
          </div>
          <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
            Install a company in one click
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
            Pre-built AI company templates ready to deploy. Research agencies, dev teams,
            marketing firms &mdash; all free, all open source.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.title}
              className="group rounded-xl border border-border-dim bg-surface-raised overflow-hidden hover:border-text-secondary/20 transition-colors"
            >
              <div className={`h-2 bg-gradient-to-r ${t.color}`} />
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">{t.title}</h3>
                  <span className="rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                    {t.agents} agents
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary">{t.desc}</p>
                <div className="mt-4 flex gap-2">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border-dim px-2 py-0.5 text-xs text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-overlay py-2 text-sm font-medium text-text-primary hover:bg-brand hover:text-white transition-colors">
                  Free Install
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a
            href="https://app.paperclip.ing/marketplace"
            className="inline-flex items-center gap-1 text-sm text-brand hover:text-brand-dark transition-colors"
          >
            Browse all templates on ClipMart <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Install ──────────────────────────────────────── */
function Install() {
  return (
    <section id="install" className="border-t border-border-dim bg-surface-raised/30 py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-text-primary sm:text-4xl">
          Get started in one command
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-text-secondary">
          Free forever. Open source. No account required.
        </p>

        {/* Install command */}
        <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-xl border border-border-dim bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border-dim px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs text-text-secondary">Terminal</span>
          </div>
          <div className="p-6">
            <code className="text-lg font-medium text-text-primary">
              <span className="text-accent-emerald">$</span> npx paperclipai onboard --yes
            </code>
          </div>
        </div>

        {/* Alt methods */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border-dim bg-surface-raised p-5">
            <Terminal className="mx-auto h-6 w-6 text-brand" />
            <h3 className="mt-3 text-sm font-semibold text-text-primary">npm / npx</h3>
            <p className="mt-1 font-mono text-xs text-text-secondary">npx paperclipai onboard</p>
          </div>
          <div className="rounded-xl border border-border-dim bg-surface-raised p-5">
            <Github className="mx-auto h-6 w-6 text-text-primary" />
            <h3 className="mt-3 text-sm font-semibold text-text-primary">GitHub</h3>
            <a
              href="https://github.com/paperclipai/paperclip"
              className="mt-1 block text-xs text-brand hover:underline"
            >
              Clone &amp; build from source
            </a>
          </div>
          <div className="rounded-xl border border-border-dim bg-surface-raised p-5">
            <BookOpen className="mx-auto h-6 w-6 text-accent-purple" />
            <h3 className="mt-3 text-sm font-semibold text-text-primary">Documentation</h3>
            <a
              href="https://paperclip.ing/docs"
              className="mt-1 block text-xs text-brand hover:underline"
            >
              Read the docs
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────── */
function CTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold text-text-primary sm:text-5xl">
          The future of work is
          <span className="bg-gradient-to-r from-brand to-accent-purple bg-clip-text text-transparent"> autonomous</span>
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary">
          Join thousands of builders creating AI-powered companies with Paperclip.
          Free, open-source, and community-driven.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#install"
            className="flex items-center gap-2 rounded-xl bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark transition-all"
          >
            <Download className="h-5 w-5" />
            Download Paperclip
          </a>
          <a
            href="https://github.com/paperclipai/paperclip"
            className="flex items-center gap-2 rounded-xl border border-border-dim bg-surface-raised px-8 py-3.5 text-base font-medium text-text-primary hover:border-text-secondary/30 transition-colors"
          >
            <Star className="h-5 w-5" />
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-border-dim bg-surface py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-brand text-xs font-black text-white">
              P
            </div>
            <span>&copy; {new Date().getFullYear()} Paperclip. Open source under MIT.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a href="https://paperclip.ing/docs" className="hover:text-text-primary transition-colors">Docs</a>
            <a href="https://github.com/paperclipai/paperclip" className="hover:text-text-primary transition-colors">GitHub</a>
            <a href="https://discord.gg/paperclip" className="hover:text-text-primary transition-colors">Discord</a>
            <a href="https://x.com/paperclipai" className="hover:text-text-primary transition-colors">Twitter</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
