# ADR 0004: Agent Activation Is Provider-Gated

- Status: accepted
- Date: 2026-07-19

## Context

Onboarding must let a Company and its Humans enter the product even when the AI provider is not ready. It also must not pretend that Autopilot works without a verified runtime or create an unrestricted system bot.

## Decision

- Company creation provisions the default Autopilot as `pending_setup`.
- The owner configures a Company Provider Connection and the system verifies it with a real test.
- The owner assigns Autopilot's Spaces, role, permissions, and initial Skills.
- The Agent becomes `active` only after both its runtime and authorization configuration are valid.
- Humans may finish Company onboarding without a working provider. The Agent remains visibly inactive and AI Runs cannot start.
- Later Agents follow the same activation lifecycle. They may share a Company Provider Connection while selecting their own allowed runtime and model.

## Consequences

- Provider state and Agent state are distinct and understandable.
- A Provider Connection grants no RBAC or data permissions; those belong to the Actor.
- The UI needs honest setup, verification, failed-test, retry, and activation states.
- Inviting Humans is not blocked by an external AI provider.

## Rejected alternatives

- **Block all onboarding on the provider:** an external service failure prevents Human-only collaboration.
- **Show Autopilot as active without verification:** creates dead Mentions and false expectations.
- **One global model for every Agent:** denies independent Agent configuration and specialization.
