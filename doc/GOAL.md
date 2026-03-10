# Paperclip

**Paperclip is the backbone of AI-powered storytelling.** We are building the infrastructure that autonomous AI writers rooms run on. Our goal is for Paperclip-powered writers rooms to collectively produce creative output that rivals the most prolific studios in history. Every decision we make should serve that: make writers rooms more capable, more governable, more scalable, and more real.

## The Vision

Autonomous writers rooms — AI writing teams organized with real structure, governance, and accountability — will become a major force in creative production. Not one room. Thousands. An entire creative layer that runs on AI talent, coordinated through Paperclip.

Paperclip is not the writers room. Paperclip is what makes writers rooms possible. We are the control plane, the nervous system, the operating layer. Every autonomous writers room needs structure, assignment management, budget control, story arc alignment, and human governance. That's us. We are to autonomous writers rooms what the showrunner's office is to human ones — except this time, the operating system is real software, not metaphor.

The measure of our success is not whether one room works. It's whether Paperclip becomes the default foundation that autonomous writers rooms are built on — and whether those rooms, collectively, become a serious creative force.

## The Problem

Task management software doesn't go far enough. When your entire writing staff is AI writers, you need more than a to-do list — you need a **control plane** for an entire writers room.

## What This Is

Paperclip is the command, communication, and control plane for a writers room of AI writers. It is the single place where you:

- **Manage writers as staff** — onboard, organize, and track who does what
- **Define room hierarchy** — org charts that writers themselves operate within
- **Track work in real time** — see at any moment what every writer is working on
- **Control costs** — token salary budgets per writer, spend tracking, burn rate
- **Align to story arcs** — writers see how their work serves the bigger creative vision
- **Store room knowledge** — a shared brain for the production

## Architecture

Two layers:

### 1. Control Plane (this software)

The central nervous system. Manages:

- Writer registry and room hierarchy
- Assignment tracking and status
- Budget and token spend tracking
- Production knowledge base
- Story arc hierarchy (production → room → writer → assignment)
- Writing session monitoring — know when writers are active, idle, or stuck

### 2. Execution Services (adapters)

Writers run externally and report into the control plane. A writer is just code that gets kicked off and does work. Adapters connect different execution environments:

- **OpenClaw** — initial adapter target
- **Writing session loop** — simple custom code that loops, checks in, does work
- **Others** — any runtime that can call an API

The control plane doesn't run writers. It orchestrates them. Writers run wherever they run and phone home.

## Core Principle

You should be able to look at Paperclip and understand your entire writers room at a glance — who's writing what, how much it costs, and whether it's working.
