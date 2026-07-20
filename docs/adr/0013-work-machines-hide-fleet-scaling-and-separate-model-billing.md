# ADR 0013: Work Machines Hide Fleet Scaling and Separate Model Billing

- Status: accepted
- Date: 2026-07-19

## Context

Operators think in terms of computers and managed execution capacity, while the scheduler needs replaceable processes, pods, leases, affinity, and concurrency. Exposing every Kubernetes Worker would make the product feel like fleet administration. Hiding all execution state would make both self-hosted and cloud operation dishonest. A customer using QUESTPIE Cloud may still want to attach and manage its own machines; managed capacity is an optional service, not the definition of the cloud control plane.

The managed cloud case adds a second distinction: QUESTPIE may provide the execution machine without absorbing the customer's model usage. Anthropic's current documentation does not permit third-party products to offer Claude.ai login or route Free, Pro, or Max credentials without prior approval. Production architecture therefore uses commercial provider APIs and treats compute and model usage as separate billable resources.

## Decision

### Product and infrastructure objects

- `Work Machine` is the Company-visible execution object. It represents a logical environment such as a Human computer, a self-hosted VPS, or managed cloud capacity.
- `Worker` is an internal replaceable process or pod. `Worker Pool` is an internal schedulable group behind a Work Machine.
- A self-hosted installation creates a `Default Work Machine`; its operator chooses its topology and may enroll additional Work Machines.
- QUESTPIE Cloud lets an authorized Company operator add, configure, drain, and remove Work Machines just as a self-hosted operator can. It may also offer one logical `QUESTPIE Managed` Work Machine backed by a K3s Worker Pool. Pod count, node replacement, and ordinary autoscaling inside that managed Work Machine remain implementation details.
- A Work Machine exposes product-relevant facts only: readiness, supported Runtimes, coarse capacity, active/queued Runs, Provider Connection availability, and actionable health. Device identifiers, leases, epochs, pods, and join-token internals stay in operator diagnostics.
- General-purpose capability does not grant authority. Every Worker still receives only the selected Agent's short-lived Run authority.

### Control plane and Work Machine provisioning are independent

The control plane has two hosting modes:

1. `self_hosted_control_plane`: the customer operates QUESTPIE and its data plane.
2. `questpie_cloud_control_plane`: QUESTPIE operates the product control plane and realtime services.

Each Work Machine independently uses one provisioning mode:

1. `manual`: the operator prepares a computer or VPS and enrolls it using a short-lived, one-time flow.
2. `guided_provider`: a first-class cloud integration provisions the customer's machine and guides runtime setup in the customer's cloud account. Hetzner is a candidate first integration.
3. `questpie_managed`: QUESTPIE provisions, patches, observes, and scales the execution capacity.

Cloud-control-plane customers may mix all three modes. Choosing QUESTPIE Cloud never removes Work Machine administration; choosing managed capacity only removes the obligation to perform it.

Guided provisioning may use an already trusted local Work Machine or an explicit setup session to help install and verify Runtime Adapters such as Claude Code or Codex on the new VPS. The flow must show its plan and effects, request the required cloud permissions, produce auditable progress, and verify the resulting machine before enrollment. It cannot bypass a model Provider's supported production authentication contract merely because the Runtime runs on the customer's VPS.

### Persistence, affinity, and concurrency

- Worker Home belongs to a Work Machine and survives ordinary Worker replacement.
- A stateful Harness Run is pinned to the compatible Worker Home. It may move only when its Runtime Adapter declares and successfully performs a supported checkpoint/resume transfer.
- A Credential Binding declares one concurrency mode: `brokered`, `shareable`, or `exclusive`.
- Browser/CLI OAuth sessions default to `exclusive` until the Runtime Adapter and Provider contract prove safe sharing and concurrency. The scheduler queues rather than cloning an exclusive session into multiple Workers.

### Billing

Infrastructure billing follows each Work Machine's provisioning mode rather than the control-plane hosting mode. A manually connected or guided-provider machine is billed by its owner/cloud provider. A `questpie_managed` Work Machine has an explicit managed compute/orchestration charge.

In every topology, model billing can use a customer-owned commercial Provider Connection where supported, or a QUESTPIE-brokered commercial account with explicit metering, budgets, quotas, and stop policies. Managed pricing presents compute/orchestration and model API usage as separate ledger dimensions. QUESTPIE does not silently absorb unbounded API cost.

Claude subscription OAuth is not a supported Autopilot production connection mode. Local interactive subscription use may exist as a developer-owned tool outside the product contract, but it cannot become a Company Provider Connection or managed-cloud credential path. Credential material is never pooled across Companies. Revocation disables new Runs immediately and leaves active Run handling to the captured Credential Binding policy.

## Consequences

- Cloud customers retain first-class Work Machine control while QUESTPIE can provide a zero-operations managed default.
- Self-hosted and cloud operators share the same Work Machine model without forcing ordinary collaborators into fleet concepts.
- Guided cloud-provider provisioning can reduce setup work without transferring machine ownership or provider billing to QUESTPIE.
- Customers can use their own commercial provider billing where supported; otherwise managed usage remains transparent and budgeted.
- Scheduling can protect stateful sessions and exclusive credentials instead of assuming every Worker is stateless and every credential is safely concurrent.
- Provider pricing changes affect the metered usage layer, not the core Run, Actor, or Work Machine model.

## Rejected alternatives

- **Expose every Worker as a machine:** leaks K3s mechanics into the product and produces unstable identities during scaling.
- **One permanent container per customer:** couples identity and credentials to replaceable compute and scales poorly.
- **Hide all machines in self-hosted deployments:** removes the operational object needed to diagnose runtime and capacity failures.
- **Cloud control plane implies managed-only Workers:** prevents customers from mixing their own machines with optional managed capacity.
- **Offer customer subscription OAuth:** conflicts with current third-party authentication restrictions and blurs personal subscription use with a Company production service.
- **QUESTPIE pays every model bill:** creates uncontrolled unit economics and prevents customers from using their negotiated provider account.
- **Clone one OAuth home across a pool:** risks credential sharing, corruption, concurrency violations, and untraceable session ownership.
