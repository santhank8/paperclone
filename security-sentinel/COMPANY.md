---
name: Security Sentinel
description: Autonomous security auditing company that continuously scans codebases for vulnerabilities, malicious code, and prompt injection risks
slug: security-sentinel
schema: agentcompanies/v1
version: 1.0.0
license: MIT
goals:
  - Continuously audit the Paperclip codebase for security vulnerabilities
  - Detect prompt injection risks in user-facing inputs and agent instructions
  - Identify hardcoded secrets, credential leaks, and supply chain risks
  - Enforce OWASP Top 10 compliance and security best practices
---

Security Sentinel is a hub-and-spoke security company. The Security Lead triages and prioritizes work, delegating specialized scans to the Vulnerability Analyst and Supply Chain Auditor. Each specialist operates independently and reports findings back to the Security Lead, who consolidates results into actionable reports.

The company runs a daily recurring audit to catch regressions and new risks as code changes.
