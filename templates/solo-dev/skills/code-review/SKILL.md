---
name: code-review
description: |
  Systematic code review process and quality standards
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [review, quality]
  roles: [reviewer, developer]
---

# Code Review

Code review is not about finding bugs (tests should do that). It is about maintaining code quality, sharing knowledge, and catching design issues early. A good review improves the code AND teaches both the author and the reviewer.

---

## 1. Review Checklist

Work through this checklist systematically. Not every item applies to every PR, but scan all of them.

### Correctness
- [ ] Does the code do what the PR description says it does?
- [ ] Are edge cases handled? (null, empty, zero, negative, max values)
- [ ] Are error paths handled? (network failures, invalid input, timeouts)
- [ ] Are race conditions possible? (concurrent access, async operations)
- [ ] Is the happy path actually tested, not just assumed?

### Security
- [ ] Is user input validated and sanitized before use?
- [ ] Are SQL queries parameterized (no string concatenation)?
- [ ] Are secrets kept out of code and logs?
- [ ] Are authorization checks in place (not just authentication)?
- [ ] Is sensitive data excluded from error messages and stack traces?
- [ ] Are new dependencies from trusted sources with no known vulnerabilities?

### Performance
- [ ] Are there N+1 query patterns? (loop with DB call inside)
- [ ] Are large datasets paginated?
- [ ] Are expensive computations cached where appropriate?
- [ ] Are database queries using indexes? (check for missing indexes on WHERE/JOIN columns)
- [ ] Is there unnecessary work in hot paths?
- [ ] Are there memory leaks? (event listeners not cleaned up, growing caches without eviction)

### Readability
- [ ] Can you understand the code without reading the PR description?
- [ ] Are variable and function names descriptive and consistent?
- [ ] Is the code organized logically? (related things together)
- [ ] Are comments explaining "why," not "what"?
- [ ] Is there dead code, commented-out code, or TODOs without context?
- [ ] Are magic numbers replaced with named constants?

### Architecture
- [ ] Does this change belong in this module/service?
- [ ] Are abstractions at the right level? (not too abstract, not too concrete)
- [ ] Is there unnecessary coupling between modules?
- [ ] Does this duplicate existing functionality?
- [ ] Is the API surface minimal? (don't expose more than needed)
- [ ] Will this be easy to modify or extend later?

### Tests
- [ ] Are there tests? (new behavior needs tests)
- [ ] Do tests cover both happy path and error cases?
- [ ] Are tests testing behavior, not implementation details?
- [ ] Are test names descriptive? ("should return 404 when user not found")
- [ ] Are tests independent? (no shared mutable state between tests)
- [ ] Are flaky patterns avoided? (timeouts, date-dependent logic, random values)

### TypeScript-Specific
- [ ] Are types precise? (avoid `any`, prefer union types over boolean flags)
- [ ] Are return types explicit on public functions?
- [ ] Are `null` and `undefined` handled consistently?
- [ ] Are type assertions (`as`) justified and safe?
- [ ] Are generic types used appropriately? (not over-engineered)

### Database
- [ ] Are migrations reversible?
- [ ] Do new columns have sensible defaults?
- [ ] Are indexes added for new query patterns?
- [ ] Is the migration safe for zero-downtime deploy? (no column renames, no NOT NULL on existing columns without defaults)

---

## 2. Common Issues (Top 10)

These are the issues that come up most frequently. Train yourself to spot them quickly.

### 1. Unvalidated Input at Boundaries

```typescript
// BAD: trusting external input
app.post('/users', (req, res) => {
  const user = req.body; // could be anything
  db.insert(users).values(user);
});

// GOOD: validate at the boundary
const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
});

app.post('/users', (req, res) => {
  const user = createUserSchema.parse(req.body);
  db.insert(users).values(user);
});
```

### 2. Swallowed Errors

```typescript
// BAD: error disappears
try {
  await sendEmail(user.email);
} catch (e) {
  // silently ignore
}

// GOOD: at minimum, log it
try {
  await sendEmail(user.email);
} catch (e) {
  logger.warn('Failed to send email', { userId: user.id, error: e });
  // decide: retry? alert? degrade gracefully?
}
```

### 3. N+1 Query Patterns

```typescript
// BAD: one query per user
const orders = await db.select().from(ordersTable);
for (const order of orders) {
  const user = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
  // ...
}

// GOOD: batch load
const orders = await db.select().from(ordersTable);
const userIds = [...new Set(orders.map(o => o.userId))];
const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
const userMap = new Map(users.map(u => [u.id, u]));
```

### 4. Missing Error Context

```typescript
// BAD: no context
throw new Error('Not found');

// GOOD: actionable error
throw new Error(`User not found: ${userId}. Called from order creation flow.`);
```

### 5. Hardcoded Configuration

```typescript
// BAD
const TIMEOUT = 5000;
const API_URL = 'https://api.example.com';

// GOOD
const TIMEOUT = config.get('http.timeout');
const API_URL = config.get('services.example.url');
```

### 6. Business Logic in Controllers

```typescript
// BAD: logic scattered in route handler
app.post('/orders', async (req, res) => {
  const user = await getUser(req.userId);
  if (user.balance < req.body.total) { /* ... */ }
  if (user.plan === 'free' && req.body.items.length > 5) { /* ... */ }
  // 50 more lines of business logic...
});

// GOOD: extract to service
app.post('/orders', async (req, res) => {
  const result = await orderService.create(req.userId, req.body);
  res.json(result);
});
```

### 7. Inconsistent Error Handling

Pick one pattern and use it everywhere. Do not mix throwing errors, returning error objects, and returning null.

### 8. Tests That Test Implementation

```typescript
// BAD: brittle, breaks on refactor
expect(service.processOrder).toHaveBeenCalledWith(order);
expect(db.insert).toHaveBeenCalledTimes(1);

// GOOD: test behavior
const result = await createOrder(orderInput);
expect(result.status).toBe('confirmed');
const saved = await db.select().from(orders).where(eq(orders.id, result.id));
expect(saved).toHaveLength(1);
```

### 9. Missing Pagination

```typescript
// BAD: returns all records
app.get('/users', async (req, res) => {
  const users = await db.select().from(usersTable);
  res.json(users);
});

// GOOD: paginated by default
app.get('/users', async (req, res) => {
  const { page = 1, limit = 50 } = paginationSchema.parse(req.query);
  const users = await db.select().from(usersTable)
    .limit(Math.min(limit, 100))
    .offset((page - 1) * limit);
  res.json({ data: users, page, limit });
});
```

### 10. Overly Broad Types

```typescript
// BAD
function processEvent(event: any): any { }
function getUser(opts: Record<string, unknown>): object { }

// GOOD
function processEvent(event: OrderCreatedEvent): ProcessingResult { }
function getUser(opts: { id: string; includeOrders?: boolean }): Promise<User> { }
```

---

## 3. How to Give Feedback

### The Prime Directive

Assume the author is competent and made their choices for reasons. Ask before assuming they missed something.

### Feedback Categories

Prefix your comments to clarify intent:

| Prefix | Meaning |
|--------|---------|
| `nit:` | Trivial style issue. Not a blocker. |
| `suggestion:` | A different approach worth considering. Not a blocker. |
| `question:` | Seeking understanding. May or may not lead to a change. |
| `issue:` | Something that should be fixed before merge. |
| `blocker:` | Must be fixed. Will not approve without this change. |

### Good Feedback Patterns

**Explain why, not just what:**

Bad: "Use a Map here."

Good: "suggestion: A Map would give O(1) lookups here instead of O(n) with the array filter. Might matter if the list grows large."

**Ask questions instead of making demands:**

Bad: "This is wrong. Fix the error handling."

Good: "question: What happens if the API returns a 429? I don't see retry logic — is that intentional?"

**Offer alternatives:**

Bad: "This is too complex."

Good: "suggestion: This could be simplified by extracting the validation into a separate function. Something like:
```typescript
const validated = validateOrderInput(input);
if (!validated.ok) return validated.error;
```
"

**Acknowledge good work:**

Don't only leave negative comments. If you see something clever, well-structured, or well-tested, say so. It reinforces good practices.

### Things to Avoid

- **Bikeshedding:** Don't spend 10 comments on variable naming in a PR that redesigns the auth system.
- **Style debates:** If the linter doesn't catch it, it's probably not worth arguing about.
- **Rewriting in the review:** If the approach is fundamentally wrong, have a conversation first. Don't leave 50 comments redesigning the PR.
- **"I would have done it differently":** Unless your way is measurably better, let the author's style stand.
- **Delayed reviews:** Review within 24 hours. A PR that sits for a week is a PR that will have merge conflicts.

### Review Size Guidelines

| PR Size (lines changed) | Expected Review Time | Recommendation |
|--------------------------|---------------------|----------------|
| < 50                     | 10-15 minutes       | Quick review   |
| 50-200                   | 30-60 minutes       | Standard review |
| 200-500                  | 1-2 hours           | Thorough review |
| > 500                    | Split the PR        | Too large for effective review |

If a PR is over 500 lines, ask the author to split it. Large PRs get rubber-stamped, not reviewed.
