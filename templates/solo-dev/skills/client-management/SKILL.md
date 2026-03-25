---
name: client-management
description: |
  Client lifecycle management — onboarding, proposals, project tracking, invoicing.
  Use when managing client relationships, writing proposals, or generating invoices.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [clients, proposals, invoicing, projects]
  roles: [strategist, meta]
---

# Client Management

How to manage the full client lifecycle from prospect to completed project.

---

## Client Onboarding Flow

```
prospect → proposal → contract → kick-off → delivery → invoice → close
```

### 1. Prospect

Create a client directory when a new prospect comes in:

```
knowledge/clients/
├── acme-corp/
│   ├── brief.md              # Initial requirements, goals
│   ├── contacts.md           # Key people, roles, emails
│   ├── history.md            # Meeting notes, decisions
│   └── proposals/
│       └── 2026-03-initial.md
```

### 2. Proposal

Write proposals using this structure:

```markdown
# Proposal: [Project Name]
## For: [Client Name]
## Date: YYYY-MM-DD

## Executive Summary
One paragraph: what we'll do, why it matters, expected outcome.

## Scope of Work
- Deliverable 1: [description]
- Deliverable 2: [description]
- Out of scope: [what we won't do]

## Timeline
| Phase | Duration | Deliverables |
|-------|----------|-------------|
| Discovery | 1 week | Requirements doc |
| Design | 2 weeks | Mockups, prototype |
| Build | 4 weeks | Working application |
| Launch | 1 week | Deployment, training |

## Investment
| Item | Amount |
|------|--------|
| Discovery & Design | $X,000 |
| Development | $X,000 |
| Launch & Training | $X,000 |
| **Total** | **$XX,000** |

## Payment Terms
- 30% upfront on contract signing
- 40% at design approval
- 30% on delivery

## Next Steps
1. Review this proposal
2. Schedule a call to discuss
3. Sign contract
4. Kick-off meeting
```

### 3. Contract

Use templates from `/knowledge/legal/`:
- `contract-template.md` — standard service agreement
- `nda-template.md` — non-disclosure agreement

### 4. Kick-off

Create a project workflow for the client:

```yaml
# team/workflows/client-acme.yaml
id: client-acme
name: "ACME Corp Project"
steps:
  - id: discovery
    assigned_role: strategist
    transitions: { done: design }
  - id: design
    assigned_role: design
    transitions: { done: build, revision: design }
  - id: build
    assigned_role: developer
    transitions: { done: review }
  - id: review
    assigned_role: reviewer
    transitions: { done: deliver, issues: build }
  - id: deliver
    assigned_role: devops
    transitions: { done: invoice }
  - id: invoice
    assigned_role: meta
```

---

## Project Tracking

Track project status in task YAML files:

```yaml
# tasks/active/task-acme-design.yaml
id: task-acme-design
title: "ACME Corp — Design Phase"
client: acme-corp
assigned_to: jordan
status: in_progress
due_date: "2026-04-15"
budget_hours: 40
logged_hours: 18
deliverables:
  - name: "Homepage mockup"
    status: done
  - name: "Dashboard mockup"
    status: in_progress
  - name: "Mobile responsive"
    status: todo
```

---

## Invoice Generation Pattern

Create invoices as structured YAML:

```yaml
# projects/invoicing/invoices/INV-2026-001.yaml
id: INV-2026-001
client: acme-corp
date: "2026-04-01"
due_date: "2026-04-15"
status: sent                    # draft | sent | paid | overdue

items:
  - description: "Discovery & Design Phase"
    quantity: 1
    rate: 5000
    amount: 5000
  - description: "Additional revision rounds (2x)"
    quantity: 2
    rate: 500
    amount: 1000

subtotal: 6000
tax_rate: 0.20
tax: 1200
total: 7200

payment:
  method: bank_transfer
  reference: "INV-2026-001"
  paid_at: null
```

---

## Meeting Notes

Document all client meetings:

```markdown
# Meeting: ACME Corp — Weekly Sync
## Date: 2026-03-25
## Attendees: John (ACME), CEO Agent, Account-Manager

## Discussion
- Reviewed homepage mockup — client approved with minor changes
- Mobile responsive deadline moved to April 20
- Client requested additional analytics dashboard page

## Action Items
- [ ] Jordan: Apply feedback to homepage mockup (by Mar 27)
- [ ] Max: Start analytics dashboard prototype (by Apr 1)
- [ ] Account-Manager: Send updated timeline to client

## Next Meeting
2026-04-01, 10:00 AM
```

Save meeting notes to `knowledge/clients/<client>/history.md` (append).

---

## Dashboard Widgets

Useful widgets for client management:

- **client-pipeline** — Kanban view: prospect → active → completed
- **project-timeline** — Gantt chart showing deliverables per client
- **revenue-forecast** — Monthly projected vs actual revenue
- **invoice-status** — Pending, paid, overdue invoices

---

## Best Practices

- **Single source of truth** — all client info in `knowledge/clients/<name>/`
- **Update after every interaction** — meeting notes, status changes, decisions
- **Track hours diligently** — update `logged_hours` on task files daily
- **Invoice promptly** — generate invoice on the day a milestone is completed
- **Keep proposals concise** — max 2 pages, focus on outcomes not process
