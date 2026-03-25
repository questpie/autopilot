# Security & Auth

## Provider Authentication

Authenticate with AI providers using subscription login or API keys:

```bash
# Subscription login (recommended)
autopilot provider login claude    # Claude Max/Pro subscription
autopilot provider login codex     # ChatGPT subscription

# Works on headless VPS — prints a URL to open on any device.

# Or use API keys (alternative)
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

## Auth Modes

| Mode | Setting | Use Case |
|------|---------|----------|
| **Disabled** (default) | `auth.enabled: false` | Solo developer, local machine |
| **Enabled** | `auth.enabled: true` | Multi-user, remote server |

When disabled: no login required, no bearer tokens, secrets stored as plain text.
When enabled: Better Auth enforced, dashboard requires login, CLI requires `autopilot auth login`.

## Enable Auth

Edit `company.yaml`:

```yaml
settings:
  auth:
    enabled: true
    cors_origin: "https://autopilot.yourdomain.com"
```

Then create the first user:

```bash
autopilot auth create-user --email admin@example.com --role owner
```

## Roles & Permissions

Defined in `team/roles.yaml`:

| Role | Access |
|------|--------|
| **owner** | Everything |
| **admin** | Manage users, approve tasks, view secrets |
| **member** | Create/update tasks, read/write knowledge |
| **viewer** | Read-only access |

## Provider & API Key Management

```bash
# Check provider auth status
autopilot provider status

# Add a secret (encrypted at rest when auth enabled)
autopilot secrets add STRIPE_KEY --value sk_live_...

# List secrets (values hidden)
autopilot secrets

# Agents reference secrets by name, never see raw values
```

## Secret Encryption

When `auth.enabled: true`:
- Secrets encrypted with AES-GCM
- Master key stored in `.auth/.master-key`
- Back up the master key: `autopilot secrets export-key > /safe/master-key.b64`

## Agent Permissions

Each agent has:
- **Tools** — which primitives they can call
- **FS scope** — which directories they can read/write
- **Deny patterns** — hardcoded blocks they cannot bypass

### Hardcoded Deny Patterns

These paths are ALWAYS blocked for agents:

| Pattern | Reason |
|---------|--------|
| `.auth/**` | Auth database, sessions, keys |
| `secrets/.master-key` | Encryption master key |
| `.data/**` | Internal database |
| `.git/**` | Git internals |
| `logs/audit/**` | Audit log (read-only via API) |

## Human Approval Gates

These actions always require human approval:

- Merge to main branch
- Deploy to production
- Publish external content
- Spend money (>$10)
- Create/delete infrastructure
- Modify team or policies
