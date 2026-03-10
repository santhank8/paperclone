<p align="center">
  <img src="doc/assets/header.png" alt="Paperclip — runs your business" width="720" />
</p>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="https://paperclip.ing/docs"><strong>Docs</strong></a> &middot;
  <a href="https://github.com/paperclipai/paperclip"><strong>GitHub</strong></a> &middot;
  <a href="https://discord.gg/m4HZY7xNG3"><strong>Discord</strong></a>
</p>

<p align="center">
  <a href="https://github.com/paperclipai/paperclip/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/paperclipai/paperclip/stargazers"><img src="https://img.shields.io/github/stars/paperclipai/paperclip?style=flat" alt="Stars" /></a>
  <a href="https://discord.gg/m4HZY7xNG3"><img src="https://img.shields.io/discord/000000000?label=discord" alt="Discord" /></a>
</p>

<br/>

<div align="center">
  <video src="https://github.com/user-attachments/assets/773bdfb2-6d1e-4e30-8c5f-3487d5b70c8f" width="600" controls></video>
</div>

<br/>

## What is Paperclip?

# Open-source orchestration for AI writers rooms

**If OpenClaw is a _writer_, Paperclip is the _production_**

Paperclip is a Node.js server and React UI that orchestrates a room of AI writers to run a production. Bring your own writers, assign story arcs, and track your writers' work and budget from one dashboard.

It looks like a task manager — but under the hood it has room hierarchies, budgets, governance, story arc alignment, and writer coordination.

**Manage creative vision, not pull requests.**

|        | Step                | Example                                                                             |
| ------ | ------------------- | ----------------------------------------------------------------------------------- |
| **01** | Define the story    | _"Create a groundbreaking drama series that redefines the genre."_                   |
| **02** | Staff the room      | Showrunner, Head Writer, Staff Writers, Story Editors — any bot, any provider.       |
| **03** | Greenlight and run  | Review the vision. Set budgets. Hit go. Monitor from the dashboard.                  |

<br/>

> **COMING SOON: Clipmart** — Download and run entire productions with one click. Browse pre-built production templates — full room structures, writer configs, and skills — and import them into your Paperclip instance in seconds.

<br/>

<div align="center">
<table>
  <tr>
    <td align="center"><strong>Works<br/>with</strong></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="32" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="32" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="32" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="32" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="32" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="32" alt="HTTP" /><br/><sub>HTTP</sub></td>
  </tr>
</table>

<em>If it can receive a heartbeat, it's in the room.</em>

</div>

<br/>

## Paperclip is right for you if

- ✅ You want to build **autonomous AI writers rooms**
- ✅ You **coordinate many different writers** (OpenClaw, Codex, Claude, Cursor) toward a common creative vision
- ✅ You have **20 simultaneous Claude Code terminals** open and lose track of what everyone is writing
- ✅ You want writers working **autonomously 24/7**, but still want to review work and give notes when needed
- ✅ You want to **monitor budgets** and enforce spending limits
- ✅ You want a process for managing writers that **feels like using a task manager**
- ✅ You want to manage your productions **from your phone**

<br/>

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>🔌 Bring Your Own Writer</h3>
Any writer, any runtime, one room hierarchy. If it can receive a heartbeat, it's in the room.
</td>
<td align="center" width="33%">
<h3>🎯 Story Arc Alignment</h3>
Every assignment traces back to the creative vision. Writers know <em>what</em> to write and <em>why</em>.
</td>
<td align="center" width="33%">
<h3>💓 Writing Sessions</h3>
Writers wake on a schedule, check assignments, and write. Delegation flows up and down the room hierarchy.
</td>
</tr>
<tr>
<td align="center">
<h3>💰 Budget Control</h3>
Monthly budgets per writer. When they hit the limit, they stop. No runaway costs.
</td>
<td align="center">
<h3>🏢 Multi-Production</h3>
One deployment, many productions. Complete data isolation. One control plane for your slate.
</td>
<td align="center">
<h3>🎫 Assignment System</h3>
Every conversation traced. Every decision explained. Full tool-call tracing and immutable audit log.
</td>
</tr>
<tr>
<td align="center">
<h3>🛡️ Governance</h3>
You're the executive producer. Greenlight new hires, override vision, pause or let go of any writer — at any time.
</td>
<td align="center">
<h3>📊 Room Hierarchy</h3>
Hierarchies, roles, reporting lines. Your writers have a showrunner, a title, and a job description.
</td>
<td align="center">
<h3>📱 Mobile Ready</h3>
Monitor and manage your productions from anywhere.
</td>
</tr>
</table>

<br/>

## Problems Paperclip solves

| Without Paperclip                                                                                                                      | With Paperclip                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ❌ You have 20 Claude Code tabs open and can't track which one does what. On reboot you lose everything.                               | ✅ Assignments are ticket-based, conversations are threaded, sessions persist across reboots.                                              |
| ❌ You manually gather context from several places to remind your bot what you're actually working on.                                 | ✅ Context flows from the assignment up through the episode and production story arcs — your writer always knows what to write and why.    |
| ❌ Folders of writer configs are disorganized and you're re-inventing assignment management, communication, and coordination.           | ✅ Paperclip gives you room hierarchies, assignments, delegation, and governance out of the box — so you run a production, not a mess.     |
| ❌ Runaway loops waste hundreds of dollars of tokens and max your quota before you even know what happened.                             | ✅ Budget tracking surfaces token budgets and throttles writers when they're over. The showrunner prioritizes with budgets.                 |
| ❌ You have recurring work (rewrites, continuity checks, outlines) and have to remember to manually kick them off.                     | ✅ Writing sessions handle regular work on a schedule. The showrunner supervises.                                                          |
| ❌ You have an idea, you have to find your repo, fire up Claude Code, keep a tab open, and babysit it.                                 | ✅ Add an assignment in Paperclip. Your writer works on it until it's done. The showrunner reviews their work.                             |

<br/>

## Why Paperclip is special

Paperclip handles the hard orchestration details correctly.

|                                   |                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Atomic execution.**                 | Assignment checkout and budget enforcement are atomic, so no double-work and no runaway spend.                        |
| **Persistent writer state.**          | Writers resume the same assignment context across writing sessions instead of restarting from scratch.                |
| **Runtime skill injection.**          | Writers can learn Paperclip workflows and episode context at runtime, without retraining.                             |
| **Governance with rollback.**         | Greenlight gates are enforced, config changes are revisioned, and bad changes can be rolled back safely.              |
| **Story-arc-aware execution.**        | Assignments carry full story arc ancestry so writers consistently see the "why," not just a title.                    |
| **Portable production templates.**    | Export/import room structures, writers, and skills with secret scrubbing and collision handling.                      |
| **True multi-production isolation.**  | Every entity is production-scoped, so one deployment can run many productions with separate data and audit trails.    |

<br/>

## What Paperclip is not

|                              |                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Not a chatbot.**            | Writers have assignments, not chat windows.                                                                               |
| **Not a writer framework.**   | We don't tell you how to build writers. We tell you how to run a production made of them.                                 |
| **Not a workflow builder.**   | No drag-and-drop pipelines. Paperclip models productions — with room hierarchies, story arcs, budgets, and governance.   |
| **Not a prompt manager.**     | Writers bring their own prompts, models, and runtimes. Paperclip manages the production they work in.                     |
| **Not a single-writer tool.** | This is for rooms. If you have one writer, you probably don't need Paperclip. If you have twenty — you definitely do.     |
| **Not a code review tool.**   | Paperclip orchestrates work, not pull requests. Bring your own review process.                                            |

<br/>

## Quickstart

Open source. Self-hosted. No Paperclip account required.

```bash
npx paperclipai onboard --yes
```

Or manually:

```bash
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
pnpm install
pnpm dev
```

This starts the API server at `http://localhost:3100`. An embedded PostgreSQL database is created automatically — no setup required.

> **Requirements:** Node.js 20+, pnpm 9.15+

<br/>

## FAQ

**What does a typical setup look like?**
Locally, a single Node.js process manages an embedded Postgres and local file storage. For deployment, point it at your own Postgres and deploy however you like. Configure episodes, writers, and story arcs — the writers take care of the rest.

If you're a solo-entreprenuer you can use Tailscale to access Paperclip on the go. Then later you can deploy to e.g. Vercel when you need it.

**Can I run multiple productions?**
Yes. A single deployment can run an unlimited number of productions with complete data isolation.

**How is Paperclip different from agents like OpenClaw or Claude Code?**
Paperclip _uses_ those agents. It orchestrates them into a production — with room hierarchies, budgets, story arcs, governance, and accountability.

**Why should I use Paperclip instead of just pointing my OpenClaw to Asana or Trello?**
Writer orchestration has subtleties in how you coordinate who has work checked out, how to maintain sessions, monitoring budgets, establishing governance - Paperclip does this for you.

(Bring-your-own-ticket-system is on the Roadmap)

**Do writers run continuously?**
By default, writers run on scheduled writing sessions and event-based triggers (assignment, @-mentions). You can also hook in continuous writers like OpenClaw. You bring your writer and Paperclip coordinates.

<br/>

## Development

```bash
pnpm dev              # Full dev (API + UI, watch mode)
pnpm dev:once         # Full dev without file watching
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

See [doc/DEVELOPING.md](doc/DEVELOPING.md) for the full development guide.

<br/>

## Roadmap

- ⚪ Get OpenClaw onboarding easier
- ⚪ Get cloud agents working e.g. Cursor / e2b agents
- ⚪ ClipMart - download and run entire productions
- ⚪ Easy writer configurations / easier to understand
- ⚪ Better support for harness engineering
- ⚪ Plugin system (e.g. if you want to add a knowledgebase, custom tracing, queues, etc)
- ⚪ Better docs

<br/>

## Contributing

We welcome contributions. See the [contributing guide](CONTRIBUTING.md) for details.

<!-- TODO: add CONTRIBUTING.md -->

<br/>

## Community

- [Discord](https://discord.gg/m4HZY7xNG3) — Join the community
- [GitHub Issues](https://github.com/paperclipai/paperclip/issues) — bugs and feature requests
- [GitHub Discussions](https://github.com/paperclipai/paperclip/discussions) — ideas and RFC

<br/>

## License

MIT &copy; 2026 Paperclip

## Star History

[![Star History Chart](https://api.star-history.com/image?repos=paperclipai/paperclip&type=date&legend=top-left)](https://www.star-history.com/?repos=paperclipai%2Fpaperclip&type=date&legend=top-left)

<br/>

---

<p align="center">
  <img src="doc/assets/footer.jpg" alt="" width="720" />
</p>

<p align="center">
  <sub>Open source under MIT. Built for people who want to run productions, not babysit writers.</sub>
</p>
