# Telegram Surface Pack — Setup

## What this pack installs

- `.autopilot/providers/telegram.yaml` — provider config
- `.autopilot/handlers/telegram.ts` — Bun handler script

## Prerequisites

1. A Telegram bot created via [@BotFather](https://t.me/BotFather)
2. The bot token from BotFather
3. A Telegram chat ID where notifications should go
4. Your orchestrator must be reachable via HTTPS (Telegram requires HTTPS for webhooks)

## Environment variables

Add these to your `.env` file in the company root:

```
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
TELEGRAM_WEBHOOK_SECRET=<random-secret-for-webhook-auth>
```

Generate a webhook secret:
```bash
openssl rand -hex 32
```

## Installation

Add to `.autopilot/company.yaml`:

```yaml
packs:
  - ref: questpie/telegram-surface
```

Then run:

```bash
autopilot sync
```

This materializes the provider config and handler into `.autopilot/`.

## Configure Telegram webhook

Point Telegram at your orchestrator's conversation inbound endpoint:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<ORCHESTRATOR_URL>/api/conversations/telegram",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

For local development with a tunnel (e.g. ngrok):

```bash
ngrok http 7778
# Then use the ngrok HTTPS URL as ORCHESTRATOR_URL
```

## Create a conversation binding

Bind a Telegram chat to a specific task for the review loop:

```bash
curl -X POST "<ORCHESTRATOR_URL>/api/conversations/bindings" \
  -H "Content-Type: application/json" \
  -H "X-Local-Dev: true" \
  -d '{
    "provider_id": "telegram",
    "external_conversation_id": "<TELEGRAM_CHAT_ID>",
    "mode": "task_thread",
    "task_id": "<TASK_ID>"
  }'
```

## Operator commands

In the bound Telegram chat:

| Command | Action |
|---------|--------|
| `/approve` | Approve the bound task |
| `/reject <reason>` | Reject with optional reason |
| Any text | Reply to the bound task (becomes instructions for next step) |
| Inline buttons | Approve/Reject buttons on notification messages |

## Outbound notifications

The handler sends notifications for:
- Task blocked (needs approval) — with inline Approve/Reject buttons
- Run completed/failed — status update with preview link if available

Messages use HTML formatting with task title, summary, and relevant links.

## Architecture

```
Telegram Bot API
    ↓ webhook
Orchestrator /api/conversations/telegram
    ↓ invoke handler
.autopilot/handlers/telegram.ts (conversation.ingest)
    ↓ normalized action
Orchestrator workflow engine (approve/reject/reply)
```

Outbound:
```
Orchestrator event bus
    ↓ notification bridge
.autopilot/handlers/telegram.ts (notify.send)
    ↓ Telegram Bot API
Telegram chat
```
