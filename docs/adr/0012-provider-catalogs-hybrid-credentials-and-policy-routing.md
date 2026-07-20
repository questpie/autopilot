# ADR 0012: Provider Catalogs, Hybrid Credentials, and Policy Routing

- Status: accepted
- Date: 2026-07-19

## Context

`@questpie/ai` must support multiple Providers, models, Runtimes, and Workers without confusing execution infrastructure with Company Actors or copying long-lived credentials into Runs. Deployment includes centrally managed credentials and may include provider-approved worker-resident sessions, but Autopilot production connections use commercial provider authentication.

## Decision

### Worker identity

- A Worker is a trusted execution node, not an Actor.
- It advertises Runtimes, capabilities, concurrency, health, and credential-binding availability.
- It has no independent access to Company data. Each execution receives short-lived Run authority for the selected Agent.

### Hybrid credential locations

- A Provider Connection is a Company-owned logical connection and references an opaque Credential Binding.
- A `managed_secret` binding keeps credential material in a central secret store. The preferred path gives the Worker a short-lived Run-scoped token to a trusted inference broker, so the provider credential never reaches the Worker.
- A managed workload that must contact a Provider directly uses provider-native workload identity where available. Otherwise it resolves a secret just in time from a secret manager inside the managed trust domain; copying long-lived Company credentials to enrolled personal devices is forbidden.
- A `worker_home` binding keeps a local or OAuth session in encrypted persistent Worker Home state. The credential does not leave that location.
- Run records, prompts, tools, logs, artifacts, generic metadata, and ordinary database reads never contain plaintext credential material.
- The control plane stores connection and verification metadata plus an opaque binding reference, not a recoverable OAuth session.

For managed Claude execution, QUESTPIE Cloud provisions isolated execution infrastructure while the Runtime Adapter uses an approved commercial API path. ADR 0013 defines the product-facing Work Machine, self-hosted versus managed deployment, and separate compute and API billing. Claude subscription OAuth is not an Autopilot production connection mode.

### Provider and model catalog

- Installed Runtime Adapters contribute credential-free Provider Definitions.
- The product can list supported Providers before a credential exists.
- Creating a Provider Connection starts explicit verification.
- A verified connection discovers available models when the Provider supports discovery; normalized Model Offerings are cached with provenance and freshness.
- A Runtime Adapter supplies a versioned fallback catalog when live discovery is unavailable.
- Free-form model identifiers are not the default product contract.

### Policy scheduling

- Each Agent has an Execution Policy defining allowed Provider Connections, Model Offerings, Runtimes, Worker Pools, preferences, and fallbacks.
- The scheduler considers only healthy Workers matching the required Runtime, capability, Credential Binding location, data locality, and concurrency policy.
- A Run snapshots the selected Provider Connection, model, Runtime, Worker, Credential Binding version, and policy revision for audit.
- An authorized Actor or Agent policy may explicitly pin an eligible target; a Worker never chooses an unapproved Provider or model on its own.

## Consequences

- Company collaboration identity remains separate from infrastructure trust.
- Managed API credentials and CLI/OAuth sessions share one logical Provider Connection model without pretending they have the same storage or delivery behavior.
- Central inference brokerage makes Worker enrollment revocation effective without requiring emergency rotation of copied provider keys.
- Worker replacement is possible only according to the Credential Binding and Worker Home portability contract; no implicit token copying is allowed.
- Provider and model settings can expose catalog, verification, freshness, usage, and operational availability as distinct states.
- Run routing is deterministic and auditable even after policies or catalogs change.

## Rejected alternatives

- **Worker as Actor:** mixes machine enrollment with team RBAC and breaks Agent attribution.
- **Central credentials only:** cannot honestly represent local or cloud-worker CLI OAuth sessions that must remain in a Worker Home.
- **Worker credentials only:** prevents managed API-key brokering and multiplies configuration across nodes.
- **Manual free-form provider/model entry as the default:** loses capability validation and safe discovery.
- **Worker chooses Provider/model:** bypasses Agent policy and makes Runs non-deterministic.
- **Plaintext credential in Run payload:** exposes long-lived authority to storage, queues, logs, and unrelated worker code.
