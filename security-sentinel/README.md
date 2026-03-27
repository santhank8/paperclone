# Security Sentinel

Autonomous security auditing company that continuously scans codebases for vulnerabilities, malicious code, and prompt injection risks.

## How It Works

Security Sentinel uses a **hub-and-spoke** workflow:

1. The **Security Lead** kicks off the daily audit cycle
2. The **Vulnerability Analyst** scans for OWASP Top 10 and code-level security issues
3. The **Supply Chain Auditor** checks dependencies, secrets, and prompt injection risks
4. Both report findings back to the Security Lead, who consolidates and triages

A daily recurring task triggers this cycle automatically at 8:00 AM UTC.

## Org Chart

| Agent | Title | Reports To | Skills |
|-------|-------|-----------|--------|
| Security Lead | Chief Security Officer | Board | vuln-scan, supply-chain-audit, prompt-injection-scan |
| Vulnerability Analyst | Vulnerability Analyst | Security Lead | vuln-scan |
| Supply Chain Auditor | Supply Chain & Prompt Injection Auditor | Security Lead | supply-chain-audit, prompt-injection-scan |

## Skills

| Skill | Description |
|-------|-------------|
| `vuln-scan` | Static analysis for OWASP Top 10 vulnerabilities, XSS, SQLi, command injection, path traversal |
| `supply-chain-audit` | Dependency risk analysis, hardcoded secret detection, supply chain security |
| `prompt-injection-scan` | Prompt injection detection in agent instructions, user inputs, and data flows |

## Getting Started

Import this company into a running Paperclip instance:

```bash
paperclipai company import --from ./security-sentinel
```

## References

- [Agent Companies Specification](https://agentcompanies.io/specification)
- [Paperclip](https://github.com/paperclipai/paperclip)
