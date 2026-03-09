# Telegram Notifier Plugin — Brainstorm

**Date:** 2026-03-09
**Status:** Accepted — proceeding to plan

## What We're Building

A Telegram notification channel plugin for Paperclip, following the established notifier pattern (webhook, Discord, ntfy). Sends event notifications to a Telegram chat via the Bot API.

## Why This Approach

- **Proven pattern**: Three existing plugins validate the interface (`type`, `label`, `send()`, `testConnection()`).
- **Simple API**: Telegram Bot API requires a single POST to `/bot<token>/sendMessage` with `chat_id` and `text`.
- **Strategic value**: Telegram covers a large developer/DevOps audience. Combined with webhook, Discord, ntfy, and email, this completes the top notification channels.

## Key Decisions

- **Config shape**: `{ botToken: string, chatId: string }` — bot token as secret ref, chat ID as plain string.
- **Message format**: Telegram MarkdownV2 for rich formatting (bold event types, code blocks for payloads). Fallback to plain text if parsing fails.
- **Sensitive fields**: `botToken` redacted in API responses (same pattern as webhook secret, Discord webhookUrl).
- **URL validation**: Not applicable — Telegram API endpoint is fixed (`api.telegram.org`), no user-supplied URLs to validate for SSRF.
- **Test connection**: Send a test message via `sendMessage` and check the API response.

## Open Questions

None — requirements are clear and pattern is established.
