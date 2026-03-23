---
name: integration-setup
description: |
  How to set up external service integrations using the 3-part pattern.
  Use when connecting to GitHub, Linear, Slack, Stripe, Telegram, or any API.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [integrations, api, webhooks, secrets]
  roles: [devops, meta]
---

# Integration Setup

Every integration follows the same 3-part pattern: **Secret + Knowledge Doc + Primitive**. No plugins, no adapters, no code changes.

---

## Step 1: Add the Secret

```bash
autopilot secrets add <service>
```

This creates `/company/secrets/<service>.yaml`:

```yaml
service: stripe
type: api_key
value: "sk_live_xxx"                    # Encrypted at rest
allowed_agents: [max, ops, ceo]
usage: |
  Use with Authorization: Bearer {value}
  Base URL: https://api.stripe.com/v1/
  Content-Type: application/x-www-form-urlencoded
```

**Security rules:**
- Only agents in `allowed_agents` can use this secret
- Values are encrypted at rest using AES-256-GCM
- Agents never see the raw key — orchestrator injects it
- All API calls are logged in the activity feed (key redacted)

---

## Step 2: Write the Knowledge Doc

Create `/company/knowledge/integrations/<service>.md` with:
- Authentication format (header name, format)
- Base URL
- Common API endpoints with examples
- Your company's conventions
- Webhook events you care about

The agent reads this doc to learn how to call the API correctly.

---

## Step 3: Configure Webhook (if needed)

Add to `/company/team/webhooks.yaml`:

```yaml
webhooks:
  - id: stripe-events
    path: /webhooks/stripe
    auth:
      type: stripe-signature
      secret_ref: "stripe_webhook_secret"
    handler: ops
    filter:
      body_path: "type"
      values: ["checkout.session.completed", "invoice.payment_failed"]
```

Supported auth types:
- `hmac-sha256` — GitHub, Linear, generic HMAC
- `stripe-signature` — Stripe webhook verification
- `token-in-url` — Telegram bot webhooks
- `bearer` — Bearer token in Authorization header

---

## Step 4: Test the Integration

```bash
autopilot ask "Test the Stripe integration by listing recent charges"
```

The agent will:
1. Read the knowledge doc
2. Call `http_request()` with `secret_ref`
3. Orchestrator injects the API key
4. Return the result

---

## Integration Examples

### GitHub

```yaml
# /company/secrets/github.yaml
service: github
type: personal_access_token
value: "ghp_xxx"
allowed_agents: [max, riley, ops, ceo]
usage: |
  Authorization: token {value}
  Base URL: https://api.github.com/
```

Agent usage: MCP server (`@modelcontextprotocol/server-github`) or `http_request()` with `secret_ref: "github"`.

### Linear

```yaml
# /company/secrets/linear.yaml
service: linear
type: api_token
value: "lin_api_xxx"
allowed_agents: [ceo, sam, max, riley]
usage: |
  Authorization: {value}
  Base URL: https://api.linear.app/graphql
  Content-Type: application/json
```

Agent usage: `http_request()` with GraphQL queries. See knowledge doc for mutation examples.

### Slack

```yaml
# /company/secrets/slack.yaml
service: slack
type: bot_token
value: "xoxb-xxx"
allowed_agents: [ceo, ops, morgan]
usage: |
  Authorization: Bearer {value}
  Base URL: https://slack.com/api/
```

Agent usage: `http_request()` to `chat.postMessage`, `channels.list`, etc.

### Stripe

```yaml
# /company/secrets/stripe.yaml
service: stripe
type: api_key
value: "sk_live_xxx"
allowed_agents: [max, ops, ceo]
usage: |
  Authorization: Bearer {value}
  Base URL: https://api.stripe.com/v1/
  Content-Type: application/x-www-form-urlencoded
```

Agent usage: `http_request()` with form-urlencoded body. Always use test keys in development.

### Telegram

```yaml
# /company/secrets/telegram.yaml
service: telegram
type: bot_token
value: "123456:ABC-xxx"
allowed_agents: [ceo, morgan]
usage: |
  Base URL: https://api.telegram.org/bot{value}/
  Content-Type: application/json
```

Agent usage: `http_request()` to `sendMessage`, `getUpdates`, etc.

---

## Security Rules

- **Principle of least privilege** — only give agents the access they need
- **Never log raw secrets** — orchestrator redacts keys in activity feed
- **Rotate regularly** — `autopilot secrets add <service>` overwrites existing
- **Audit access** — check activity feed for unexpected API calls
- **Test with test keys** — use sandbox/test credentials during development
- **Webhook verification** — always configure `auth` in webhooks.yaml
