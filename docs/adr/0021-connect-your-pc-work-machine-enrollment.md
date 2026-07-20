---
status: accepted
---

# Connect-your-PC Work Machine enrollment

This ADR decides the zero-friction enrollment flow that ADR 0019 left open-preference: how a **non-technical customer connects their own computer** as a `manual` Work Machine, so their work runs locally at no managed-compute charge (connected-PC-first). It builds on ADR 0013 (Work Machines and provisioning modes), ADR 0012 (credential delivery), ADR 0001 (worker trust boundary), and ADR 0019 (Builder execution). It is grounded by a current (2026-07-20) device-enrollment landscape research pass with explicit primary sourcing. The owner has **accepted** it; implementation is a later Work-Machine vertical.

The load-bearing constraint from ADR 0019 carries over: enrolling the machine must require **near-zero manual work on it** — no Docker, no terminal, no hand-edited config.

## Decision

### Enrollment packaging and sign-in

The customer connects their computer by downloading a **native, code-signed installer** with a background **tray / menu-bar app**, and signing in through the **browser** — the Tailscale shape. There is no terminal step and no token to paste.

Code-signing and notarization on **both macOS and Windows** are a hard, day-one requirement, not a polish item: an unsigned installer trips Gatekeeper / SmartScreen and reads as malware to a non-technical user (the research documents Cloudflare's roughly four-year unsigned-Windows-binary saga flagged by Defender as malware, and Docker's 2025 signing-certificate incident). A curl-pipe / token-paste flow (Cloudflare Tunnel, ngrok, GitHub self-hosted runner) is rejected as developer-oriented, against the non-technical target. A web-only, no-agent approach is rejected because the machine cannot be a compute node without a local process — the harness needs a local shell, filesystem, and ports (ADR 0019). The tray app also surfaces machine status, drain, and removal.

### Enrollment handshake and machine identity

Enrollment uses the OAuth 2.0 Device Authorization Grant (RFC 8628): the app shows a short code — or, better, a clickable deep-link / QR via `verification_uri_complete` so nothing is typed — the customer approves in the browser under the ordinary Company sign-in, and the machine is bound. Following the Tailscale pattern, the machine **generates its own device keypair (Ed25519) first**; the private key never leaves the device, and the server links only the public key to the Company and this Work Machine. The device keypair is the machine's identity.

For a customer's own single-user `manual` Work Machine, **no hardware attestation** (TPM / Secure Enclave / mTLS-CA) is required at enrollment: the blast radius of a compromise is contained to that one customer's own account and jobs — structurally the same trust already extended to an OS login or a personal SSH key. Hardware-backed key storage (OS keychain, Secure Enclave, Windows Hello) is used opportunistically when present. Real attestation machinery is reserved for a shared multi-tenant Worker Pool — where other tenants' trust depends on the node — or offered as an optional "harden this device" upgrade, never a default enrollment gate. A typed one-time token or a durable user-held secret (1Password / ngrok shape) is rejected as higher friction and a long-term custodial burden on a non-technical user. The deciding variable for attestation strength is how many other parties' trust depends on the node behaving correctly, not the device's value.

### Credential and model delivery

Model and credential delivery follows ADR 0012 unchanged — which the research independently validated as the industry-converged pattern (GitHub Actions OIDC, RFC 8693 token exchange, AWS Roles Anywhere / GCP Workload Identity Federation, HashiCorp Vault dynamic secrets, Teleport per-job SPIFFE certs, GitHub JIT runners). A standing Company API key is **never** copied to the enrolled personal device. The device holds only its narrow device identity (the enrollment keypair); each Run separately exchanges that identity at a trusted broker for a short-lived, task-scoped token or a brokered inference call. The Company's own Provider Connection key stays server-side in the SecretStore; the connected PC never stores it. This holds identically for a self-hosted control plane (where the broker is the self-hosted server) and for managed cloud.

### Execution, Runtime Adapter setup, and lifecycle

A connected `manual` Work Machine runs the same `createLocalHostSandbox` executor as the localhost / self-hosted dev loop (ADR 0019) — a trusted single-user executor, which is exactly right for a customer's own machine running their own Company's work. The installer auto-installs and updates the required Runtime Adapter (e.g. the coding CLI) so the customer does no manual setup, honoring the near-zero-manual-work constraint.

Lifecycle follows GitHub's low-ceremony pattern: the machine reports Idle / Active / Offline over an outbound long-poll (the machine always initiates the connection, so it works behind NAT with no inbound ports), and removal is one click and immediately invalidates the device key — a removed machine must re-enroll. The tray app exposes drain (stop taking new work, let in-flight work finish) and remove.

When a connected machine disappears mid-Run, the heartbeat is treated as **advisory / best-effort**, not a guaranteed grace period — no incumbent solves live migration of work pinned to a personal machine (the closest precedent, AWS Spot interruption, pushes checkpoint/resume to the application layer). The Run is marked **failed and resumable** rather than silently retried on another node, consistent with ADR 0019's Draft-affinity (a stateful Run is pinned to its Worker Home and does not live-transfer). Retry is a new linked Run once the machine is back or on another eligible target. Scheduling remains **connected-PC-first** (ADR 0019 tenancy/pricing): work runs on the customer's connected machine at no managed-compute charge, falling back to the managed pool only when no eligible connected machine is available.

## Status and scope

This ADR is **accepted**. It fixes the connect-your-PC enrollment shape — a signed native installer + tray app + browser sign-in, an RFC 8628 handshake with a self-generated device keypair and no hardware attestation for a single-user machine, ADR-0012 brokered per-Run credentials, the ADR-0019 local-host executor with auto-installed Runtime Adapters, and GitHub-style lifecycle with advisory heartbeats and failed/resumable Runs on disconnect — but not the implementation, which is a later Work-Machine vertical (ADR 0013 named it a designed-end-to-end feature, not Week 1). Code-signing / notarization on both operating systems is the one hard prerequisite that must be resourced before this ships to non-technical users.
