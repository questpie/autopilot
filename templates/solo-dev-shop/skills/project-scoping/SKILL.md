---
name: project-scoping
description: |
  How to scope features and estimate work
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [planning, estimation]
  roles: [strategist, planner]
---

# Project Scoping

Good scoping is the difference between a project that ships on time and one that drags on for months. The goal is not to predict the future perfectly — it is to make uncertainty explicit so you can make informed decisions about what to build and when.

---

## 1. Discovery Questions

Before you scope anything, answer these questions. If you cannot answer them, you are not ready to scope.

### Problem Understanding

- **What problem are we solving?** State it in one sentence from the user's perspective.
- **Who has this problem?** How many users? Which segment?
- **How painful is it?** Are users complaining? Churning? Working around it?
- **How do they solve it today?** What's the current workflow (even if it's manual)?
- **What happens if we don't solve it?** What's the cost of inaction?

### Solution Understanding

- **Is the solution obvious?** If not, do we need a spike/prototype first?
- **Has this been solved elsewhere?** Can we learn from competitors or open-source solutions?
- **What's the simplest thing that could work?** Strip away nice-to-haves.
- **What are the technical unknowns?** List them. Each unknown is a risk.

### Constraints

- **What's the deadline?** Is it real (contractual, regulatory) or aspirational?
- **Who is available to work on this?** What percentage of their time?
- **What dependencies exist?** Other teams, services, data, external APIs?
- **What can't we change?** Existing schemas, APIs, contracts?
- **What's the budget?** Infrastructure costs, third-party services?

### Success Criteria

- **How will we know this worked?** Define measurable outcomes.
- **What metrics will change?** Be specific: "Reduce support tickets for X by 50%."
- **When will we evaluate?** Set a date for the post-launch review.

---

## 2. Scope Definition

### The Scope Document

After discovery, write a scope document:

```markdown
# Scope: [Feature Name]

## Problem
[One paragraph from discovery]

## Proposed Solution
[High-level description — not implementation details]

## In Scope
- Capability 1: [what the user will be able to do]
- Capability 2: [what the user will be able to do]
- Capability 3: [what the user will be able to do]

## Explicitly Out of Scope
- Thing 1: [why it's excluded]
- Thing 2: [why it's excluded — can be added later]

## Success Criteria
- [ ] Metric 1: [specific, measurable]
- [ ] Metric 2: [specific, measurable]

## Dependencies
- [Dependency 1] — [status, owner]
- [Dependency 2] — [status, owner]

## Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Risk 1 | Medium | High | Mitigation plan |
| Risk 2 | Low | High | Mitigation plan |

## Rough Estimate
[T-shirt size: S/M/L/XL — see estimation section]
```

### Scope Creep Prevention

Scope creep is the primary cause of project delays. Prevent it with:

1. **Write the scope down.** Verbal agreements are not scope agreements.
2. **List non-goals explicitly.** "Out of scope" is as important as "in scope."
3. **Require a new scope review for additions.** Any new requirement triggers a scope discussion.
4. **Track scope changes.** Keep a log of what was added and why.
5. **Use the "parking lot."** Good ideas that are out of scope go in a parking lot for the next iteration.

### The "Cut" Exercise

After defining scope, do a cut exercise:

1. List every capability in the scope.
2. For each one, ask: "Could we ship without this?"
3. Move everything non-essential to "Phase 2."
4. What remains is your MVP.

This is painful but necessary. A shipped feature that does 3 things well beats a delayed feature that does 10 things poorly.

---

## 3. Estimation Techniques

### T-Shirt Sizing

For initial rough estimates, use t-shirt sizes. These are ranges, not commitments.

| Size | Effort Range | Typical Scope |
|------|-------------|---------------|
| **XS** | < 1 day | Config change, copy update, bug fix |
| **S** | 1-3 days | Simple feature, single endpoint, small UI change |
| **M** | 1-2 weeks | Feature with multiple components, new API surface |
| **L** | 2-4 weeks | Cross-cutting feature, new service, significant refactor |
| **XL** | 1-3 months | New system, major migration, platform feature |

### Task Breakdown Estimation

After t-shirt sizing, break work into tasks and estimate each:

```markdown
## Task Breakdown: User Import Feature (Estimated: M — 8 days)

### Backend (5 days)
- [ ] CSV parser with validation (1 day)
- [ ] Bulk user creation service (1 day)
- [ ] Background job for async processing (1 day)
- [ ] Error reporting and partial success handling (1 day)
- [ ] Integration tests (1 day)

### Frontend (2 days)
- [ ] Upload form with drag-and-drop (0.5 day)
- [ ] Progress indicator and error display (0.5 day)
- [ ] Download CSV template (0.5 day)
- [ ] E2E tests (0.5 day)

### DevOps (1 day)
- [ ] Background job infrastructure (0.5 day)
- [ ] Monitoring and alerting (0.5 day)
```

### Estimation Rules of Thumb

1. **Double your first estimate.** Your first estimate is always optimistic.
2. **Estimate in ideal days, then multiply by 1.5** to account for meetings, reviews, context switching.
3. **If a task seems larger than 3 days, break it down further.** You're probably missing something.
4. **Include testing time in the estimate.** Tests are not optional. Budget 20-30% of development time for tests.
5. **Include review and deployment time.** A feature is not done when the code is written.
6. **Estimate unknowns as spikes.** If you don't know how long something will take, time-box a spike: "Spend 2 hours investigating. Then we'll estimate."

### Confidence Levels

Communicate uncertainty explicitly:

```
Estimate: 2 weeks
Confidence: 70%
Range: 1.5 - 3 weeks

Key uncertainties:
- Third-party API documentation is incomplete (may need to reverse-engineer)
- Database migration on production table with 10M rows (may need zero-downtime approach)
```

---

## 4. Risk Assessment

### Risk Categories

| Category | Examples |
|----------|---------|
| **Technical** | Unknown API, untested technology, complex migration |
| **Dependency** | Waiting on another team, external vendor, regulatory approval |
| **Resource** | Key person unavailable, competing priorities |
| **Scope** | Requirements unclear, stakeholders not aligned |
| **Timeline** | Hard deadline, insufficient buffer |

### Risk Matrix

Plot each risk on this matrix to prioritize mitigation efforts:

```
         High Impact
              │
  Mitigate    │    Prevent
  immediately │    at all costs
              │
Low ──────────┼────────── High
Probability   │          Probability
              │
  Accept      │    Monitor
  the risk    │    closely
              │
         Low Impact
```

### Risk Mitigation Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **Avoid** | Remove the risk entirely | Don't use the untested technology |
| **Mitigate** | Reduce probability or impact | Add a fallback mechanism |
| **Transfer** | Shift risk to someone else | Use a managed service instead of self-hosting |
| **Accept** | Risk is low-impact or low-probability | Document and move on |

### Spike-Driven De-risking

For technical unknowns, use time-boxed spikes:

```markdown
## Spike: Can we use Stripe Connect for marketplace payments?

**Time box:** 4 hours
**Questions to answer:**
1. Does Stripe Connect support our payout schedule? (daily, net-30)
2. Can we handle split payments (platform fee + vendor payout)?
3. What's the onboarding flow for vendors?

**Success criteria:**
- Working prototype of a split payment
- List of limitations or blockers
- Go/no-go recommendation

**If it doesn't work:**
- Alternative: Build custom payout system using Stripe transfers
- Impact: +2 weeks to the project timeline
```

---

## 5. MVP vs. Full Feature

### The MVP Mindset

An MVP (Minimum Viable Product) is the smallest version of a feature that provides value and generates learning. It is NOT:
- A half-built feature that doesn't work
- A prototype that's not production-ready
- A feature with "temporary" shortcuts that never get fixed

An MVP IS:
- A complete, working feature with a deliberately reduced scope
- Production-quality code for the functionality it includes
- Instrumented to measure whether it solves the problem

### MVP Decision Framework

For each capability in your scope, categorize it:

| Category | Definition | Include in MVP? |
|----------|-----------|----------------|
| **Must have** | Feature is unusable without it | Yes |
| **Should have** | Important but workaround exists | Probably not |
| **Could have** | Nice to have, enhances experience | No |
| **Won't have** | Explicitly excluded for now | No |

### Example: MVP for "Team Workspaces"

```markdown
## Full Feature Scope
- Create/edit/delete workspaces
- Invite members with roles (Owner, Admin, Member, Viewer)
- Move projects between workspaces
- Per-workspace billing
- Workspace-level settings (timezone, language)
- Workspace activity feed
- Workspace-level API keys
- SSO per workspace
- Cross-workspace project sharing

## MVP Scope
- Create workspaces (edit/delete later)
- Invite members with 2 roles (Owner, Member)
- Move projects between workspaces
- Single billing account (per-workspace billing later)

## What We Learn from MVP
- Do users actually create multiple workspaces?
- What role granularity do they need?
- Is moving projects between workspaces common?

## Phase 2 (Based on MVP Learnings)
- Role granularity (Admin, Viewer)
- Per-workspace billing
- Workspace settings
```

### Phased Delivery

Break large features into phases that each deliver value:

```
Phase 1 (Week 1-2): Core functionality — users can do the basic thing
Phase 2 (Week 3-4): Enhanced functionality — based on Phase 1 feedback
Phase 3 (Week 5+):  Polish and edge cases — optimize the experience
```

Each phase should be independently deployable and valuable. If Phase 2 never happens, Phase 1 should still be useful.

---

## 6. Scoping Checklist

Before committing to a timeline:

- [ ] Problem is clearly defined and validated
- [ ] Solution has been discussed (not just decided by one person)
- [ ] Scope is written down with in-scope and out-of-scope sections
- [ ] MVP has been identified (what's the smallest valuable version?)
- [ ] Tasks are broken down to < 3 days each
- [ ] Estimates include testing, review, and deployment time
- [ ] Risks are identified with mitigation strategies
- [ ] Dependencies are mapped and owners confirmed
- [ ] Success criteria are defined and measurable
- [ ] Stakeholders have reviewed and agreed to the scope
