---
name: Incident Response
description: How to handle production incidents
roles: [devops, developer]
---

# Incident Response

When production breaks, every minute matters. This guide ensures you respond systematically instead of panicking. The goal is: **detect fast, mitigate fast, fix permanently, learn from it.**

---

## 1. Severity Levels

Classify every incident immediately. Severity determines the response urgency and communication requirements.

| Severity | Name | Definition | Response Time | Examples |
|----------|------|------------|---------------|----------|
| **SEV-1** | Critical | Service is down or data is being lost. All users affected. | Immediate (< 15 min) | Database corruption, complete outage, security breach, data leak |
| **SEV-2** | Major | Core functionality is degraded. Many users affected. | < 30 min | Payment processing failing, auth broken for subset of users, severe performance degradation |
| **SEV-3** | Minor | Non-critical functionality is impaired. Some users affected. | < 2 hours | Admin panel broken, export feature failing, non-critical background jobs stuck |
| **SEV-4** | Low | Cosmetic or minor issue. Workaround exists. | Next business day | UI glitch, incorrect error message, non-blocking warning in logs |

### Escalation Rules

- **SEV-1:** All hands on deck. Notify stakeholders immediately. Status page updated.
- **SEV-2:** Primary on-call responds. Notify team lead. Status page updated if user-facing.
- **SEV-3:** On-call investigates during business hours. No status page update needed.
- **SEV-4:** Create a ticket. Fix in normal sprint flow.

---

## 2. Response Steps

### Step 1: Acknowledge (First 5 Minutes)

1. **Acknowledge the alert.** Respond in the incident channel so others know someone is on it.
2. **Classify severity.** Use the table above. When in doubt, go one level higher.
3. **Start an incident log.** Create a document or thread with timestamps for everything you do.

```
[14:32] INCIDENT STARTED — SEV-2
[14:32] Reports of payment failures. Investigating.
[14:35] Confirmed: Stripe webhook endpoint returning 500s.
```

### Step 2: Assess (5-15 Minutes)

1. **What is the blast radius?** How many users are affected? Which features are broken?
2. **When did it start?** Check monitoring dashboards, deployment history, and recent changes.
3. **What changed recently?** The cause is almost always a recent deployment, config change, or upstream dependency.

Key diagnostic commands:

```bash
# Check recent deployments
git log --oneline -10 --since="2 hours ago"

# Check application logs
tail -f /var/log/app/error.log
# or
kubectl logs -f deployment/api --tail=100

# Check resource utilization
htop  # or kubectl top pods

# Check database connections
SELECT count(*) FROM pg_stat_activity;

# Check external dependency health
curl -w "%{http_code}" https://api.stripe.com/v1/health
```

### Step 3: Mitigate (15-60 Minutes)

**Mitigation is not a fix.** The goal is to stop the bleeding. Fix it properly later.

Common mitigation strategies (try in this order):

1. **Rollback the last deployment.** This fixes the problem 60% of the time.
2. **Disable the feature flag.** If the broken code is behind a flag, turn it off.
3. **Scale resources.** If it's a capacity issue, add more instances.
4. **Redirect traffic.** Route around the broken component.
5. **Apply a hotfix.** Only if the above options don't work. Keep the hotfix minimal.

```bash
# Rollback deployment
git revert HEAD --no-edit && git push origin main
# or
kubectl rollout undo deployment/api

# Scale up
kubectl scale deployment/api --replicas=5

# Toggle feature flag
curl -X PATCH https://api.flagservice.com/flags/payments-v2 \
  -d '{"enabled": false}'
```

### Step 4: Communicate

Update stakeholders at regular intervals, even if there is no new information. Silence during an incident is worse than "still investigating."

**Internal updates:** Every 15 minutes for SEV-1, every 30 minutes for SEV-2.

**External updates (status page):**

```
[14:45] Investigating — We are investigating reports of failed payment processing.
[15:10] Identified — We have identified the cause and are implementing a fix.
[15:35] Monitoring — A fix has been deployed. We are monitoring for stability.
[16:00] Resolved — Payment processing has been restored. All transactions are processing normally.
```

### Step 5: Resolve

1. Confirm the mitigation is working. Check metrics, logs, and user reports.
2. Monitor for at least 30 minutes after mitigation.
3. Declare the incident resolved.
4. Schedule a post-mortem within 48 hours.

---

## 3. Communication Template

### Internal Incident Update

```
## Incident: [Brief Title]
**Severity:** SEV-[1/2/3]
**Status:** Investigating / Identified / Mitigating / Monitoring / Resolved
**Started:** YYYY-MM-DD HH:MM UTC
**Duration:** X hours Y minutes (or "ongoing")
**Impact:** [Who is affected and how]

### Current Understanding
[What we know about the cause]

### Actions Taken
- [14:32] Acknowledged alert
- [14:40] Identified root cause: [description]
- [14:55] Applied mitigation: [what was done]

### Next Steps
- [What is being done next]
- [Who is doing it]

### Need Help?
Contact: @oncall-engineer in #incidents
```

### External Status Page Update

Keep it simple, factual, and free of technical jargon.

```
## Payment Processing Issue

**[Investigating]** We are aware of an issue affecting payment processing
and are actively investigating. We will provide updates as we learn more.

**[Identified]** We have identified the cause of the payment processing
issue and are working on a fix. Payments may fail intermittently during
this time.

**[Resolved]** The payment processing issue has been resolved. All payments
are processing normally. Any failed payments during the incident window
will be automatically retried.
```

---

## 4. Post-Mortem Template

Post-mortems are **blameless**. The goal is to improve the system, not to assign blame. If a human made an error, the question is: "Why did the system make it easy to make that error?"

```markdown
# Post-Mortem: [Incident Title]

## Summary
One paragraph: what happened, when, how long, and the impact.

## Timeline (all times in UTC)
| Time  | Event |
|-------|-------|
| 14:30 | Deployment of commit abc123 to production |
| 14:32 | Alert fired: 5xx rate > 5% |
| 14:35 | On-call acknowledged, began investigation |
| 14:40 | Root cause identified: missing database index |
| 14:50 | Hotfix deployed: added index |
| 15:05 | Error rate returned to baseline |
| 15:30 | Incident declared resolved |

## Root Cause
Detailed technical explanation of what went wrong and why.

## Impact
- **Duration:** 35 minutes
- **Users affected:** ~2,000 (15% of active users)
- **Revenue impact:** ~$X in failed transactions (all recovered)
- **Data loss:** None

## What Went Well
- Alert fired within 2 minutes of the issue starting
- On-call responded immediately
- Rollback was fast thanks to CI/CD pipeline

## What Went Wrong
- The missing index was not caught in code review
- Load testing does not cover this query pattern
- No runbook existed for this failure mode

## Action Items
| Action | Owner | Priority | Deadline |
|--------|-------|----------|----------|
| Add index migration test to CI | @engineer | High | 2024-01-20 |
| Update load test suite with new query patterns | @devops | Medium | 2024-01-25 |
| Create runbook for database performance issues | @oncall | Medium | 2024-01-22 |
| Add query performance monitoring dashboard | @devops | Low | 2024-02-01 |

## Lessons Learned
What should we do differently? What should we keep doing?
```

### Post-Mortem Rules

1. **Hold it within 48 hours** while memory is fresh.
2. **Blameless.** "The deployment caused..." not "Alice caused..."
3. **Action items must have owners and deadlines.** Otherwise they never happen.
4. **Share the post-mortem widely.** The whole team should learn from every incident.
5. **Track action items to completion.** Review in weekly standups until done.

---

## 5. On-Call Checklist

### Starting Your On-Call Shift

- [ ] Verify you have access to monitoring dashboards
- [ ] Verify alert routing points to your phone/pager
- [ ] Review any ongoing incidents or known issues
- [ ] Check the recent deployment log for anything risky
- [ ] Ensure you have VPN/SSH access to production systems
- [ ] Have the escalation contact list handy

### During an Incident

- [ ] Acknowledge the alert within 5 minutes
- [ ] Classify severity
- [ ] Start an incident log with timestamps
- [ ] Communicate status in the incident channel
- [ ] Focus on mitigation first, root cause second
- [ ] Update stakeholders at regular intervals
- [ ] Document every action taken

### After an Incident

- [ ] Confirm resolution with monitoring data
- [ ] Update the status page
- [ ] Write a brief summary in the incident channel
- [ ] Schedule a post-mortem if SEV-1 or SEV-2
- [ ] Hand off any remaining work to the next on-call
