# ADR 0002: An Agent Is an Independent First-Class Actor

- Status: accepted
- Date: 2026-07-19

## Context

Autopilot must behave as a team member, not as a feature or process acting through a Human's identity. Universally intersecting requester and Agent permissions would turn the Agent into a delegated wrapper and violate Actor parity from the old sketches and v2 brief.

## Decision

A Company may have multiple Agents. Every Agent, including Autopilot, is an independent Company Actor. Autopilot is only the default general-purpose Agent, not a shared identity for all AI work.

- Each Agent has its own Space memberships, roles, and permissions.
- Each Agent has its own Skills defining capabilities and allowed tools.
- Different Agents may have different responsibilities, access, and Skills; their identities and audit trails never merge.
- A Run is authorized as the Agent. It does not use the requesting Human's permissions or ambient `system` authority.
- The requester, request, selected Skill, Agent authority, and effects remain attributable and auditable.
- A Mention or assignment is a work request, not identity or permission delegation.
- The target Agent evaluates the concrete Task context against its own RBAC, selected Skill, and effect policy.
- If it cannot proceed, it performs no protected effect. The Run pauses and the Agent asks an authorized Human in the Thread for the specific missing permission.
- Approval is scoped by default to one Run, named action, and target data, then expires when the Run completes or is cancelled.
- Durable changes to Agent membership, roles, or permissions require a separate RBAC operation and are never a side effect of approving a Run.

### Requestability boundary

Not every inability to continue is temporarily approvable:

| Failure | Run behavior | How it is resolved |
| --- | --- | --- |
| Request acceptance denied, missing anchor membership, inactive/suspended Agent, or undisclosable target | reject before execution or stop without revealing the target; no one-Run grant | change membership/request policy through a separate authorized administration command |
| Missing exact target-operation RBAC that the current effect policy permits delegating | persist one exact Permission Request and pause the same Run | an eligible Human with both review and underlying operation authority may approve only this Run/attempt/effect/payload until expiry |
| Missing Skill, tool declaration, effect ceiling, disclosure policy, or execution-policy capability | fail closed; no Permission Request may widen it | publish and bind a new Skill/policy revision through separate administration and start a fresh authorized attempt where applicable |
| Missing provider, model, Runtime, Worker or capacity | show setup unavailable or use a bounded queued/retryable-failure path | repair provider/runtime/capacity configuration; never treat infrastructure readiness as Human permission |
| Risk-classified external, destructive, financial, access-control or cross-Space disclosure effect | persist an exact Review Gate request before mutation | eligible reviewer approves the exact prepared effect; commit rechecks authority and writes one receipt |

A Permission Request never edits RBAC, Skill, provider, runtime, membership, request policy, execution policy, or disclosure policy. A configuration-only attention recipient may repair those records but cannot approve the blocked effect unless independently eligible.

## Consequences

- Humans and Agents use the same assignment, Mention, and audit model.
- A Company composes an AI team from multiple narrow or general Agents instead of one unrestricted Agent.
- An Agent may have different permissions from the requester, like a Human teammate with a different role.
- A Skill does not replace RBAC. A Run fails safely when a Skill knows a tool but the Agent cannot access the target data or action.
- A privileged Agent needs request-acceptance rules so it cannot become a path around requester permissions.
- AI work needs an explicit `waiting_for_permission` state. Approval, denial, and resumption are attributable events on the same Run.
- A Permission Request names the action, target data, reason, and scope. An ambiguous request cannot unlock general access.
- The interface offers an explicit decision for the concrete Run and never hides durable access inside one-time approval.

## Rejected alternatives

- **Agent impersonates requester:** denies independent identity and weakens auditability.
- **Universal requester-Agent permission intersection:** prevents legitimate delegation between teammates with different roles.
- **Ambient `system` Agent:** hides real authority and grants disproportionate access.
