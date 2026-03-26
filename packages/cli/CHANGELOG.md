# @questpie/autopilot

## 1.1.0

### Minor Changes

- [`4558577`](https://github.com/questpie/autopilot/commit/455857765ef97937992cad5fea1f632be1c7b987) Thanks [@drepkovsky](https://github.com/drepkovsky)! - Security hardening: 22 fixes across auth, API, agents, secrets, and dashboard

  **API Security:** CORS locked to configured origin (not `*`), security headers (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy), X-Forwarded-For trusted proxy validation, request body size limits, reduced status endpoint payload for unauthenticated requests.

  **Agent Sandbox:** SSRF protection blocks private IPs in `http_request` tool, optional domain allowlist via `agent_http_allowlist`, per-agent `tools` config controls Claude SDK built-in tools (`fs` → read-only, `fs_write` → read/write, `terminal` → Bash), `PreToolUse` hooks enforce `fs_scope` write globs on Write/Edit and deny patterns on Read, filesystem browser enforces role-based scope for viewers.

  **Rate Limiting:** Agents now rate-limited (600/min general, 50/min search, 100/min chat), weighted sliding window algorithm, password reset rate limiter (3/15min), timing-safe HMAC and bearer token comparison.

  **Secrets & Keys:** Agent keys persisted across restarts (encrypted with master key), encrypted YAML support, secret masking in logs, API key hashing utility.

  **Auth:** Mandatory 2FA for owner/admin roles, invite-only registration via `.auth/invites.yaml`, password complexity (min 12 chars, digit + special), banned user session blocking, dashboard uses cookie-based auth (no more token in query params).

### Patch Changes

- Updated dependencies [[`4558577`](https://github.com/questpie/autopilot/commit/455857765ef97937992cad5fea1f632be1c7b987)]:
  - @questpie/autopilot-spec@1.1.0
  - @questpie/autopilot-orchestrator@1.1.0

## 1.0.0

### Major Changes

- [`6835941`](https://github.com/questpie/autopilot/commit/6835941c81d91a2e9575636b3d679b4520c446b7) Thanks [@drepkovsky](https://github.com/drepkovsky)! - Initial public release of QUESTPIE Autopilot.

  AI-native company operating system. Filesystem as database, agents as employees, workflows as YAML.

### Patch Changes

- Updated dependencies [[`6835941`](https://github.com/questpie/autopilot/commit/6835941c81d91a2e9575636b3d679b4520c446b7)]:
  - @questpie/autopilot-spec@1.0.0
  - @questpie/autopilot-orchestrator@1.0.0
