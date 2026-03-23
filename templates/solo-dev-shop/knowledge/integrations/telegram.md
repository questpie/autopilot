# Telegram Bot Integration

## Creating a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g. "QuestPie Autopilot") and username (e.g. `questpie_autopilot_bot`)
4. BotFather will give you a bot token like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
5. Store the token as a secret:
   ```bash
   autopilot secrets add telegram --value "YOUR_BOT_TOKEN"
   ```

## Setting Up the Webhook

Telegram delivers messages to your bot via a webhook URL. After starting the orchestrator:

```bash
# Set the webhook (replace with your public URL)
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/hooks/telegram"}'
```

For local development, use a tunnel (e.g. ngrok, cloudflared):

```bash
ngrok http 7777
# Then set webhook to the ngrok URL + /hooks/telegram
```

## Bot API Endpoints

### sendMessage

```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
{
  "chat_id": 123456789,
  "text": "Hello from Autopilot!",
  "parse_mode": "Markdown"
}
```

### getUpdates (polling fallback)

```
GET https://api.telegram.org/bot<TOKEN>/getUpdates?offset=0&limit=10
```

Not used when webhooks are configured, but useful for debugging.

### setWebhook

```
POST https://api.telegram.org/bot<TOKEN>/setWebhook
{
  "url": "https://your-domain.com/hooks/telegram",
  "allowed_updates": ["message"]
}
```

### deleteWebhook

```
POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

## Telegram Update Object

When a message arrives, Telegram sends a JSON payload:

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": { "id": 987654321, "first_name": "John", "username": "john" },
    "chat": { "id": 987654321, "type": "private" },
    "date": 1234567890,
    "text": "@sam check the spec for v2"
  }
}
```

## How Agents Use Telegram

1. User sends a message to the bot (or in a group where the bot is a member)
2. The webhook handler at `/hooks/telegram` receives the update
3. If the message contains `@agent_name`, that agent is spawned
4. If no mention is found, the message routes to the CEO agent
5. The agent processes the request using its tools
6. The agent's response is sent back to the same Telegram chat via `sendMessage`

## Message Formatting

Telegram supports Markdown in messages:

- `*bold*` for bold text
- `_italic_` for italic text
- `` `code` `` for inline code
- ` ```code block``` ` for code blocks
- `[link text](url)` for links

Note: Telegram uses a simplified Markdown. Avoid nested formatting.

## Group Chat Setup

1. Add the bot to a Telegram group
2. Make it an admin (or disable privacy mode via BotFather `/setprivacy`)
3. The bot will receive all messages in the group
4. Use @mentions to direct messages to specific agents
