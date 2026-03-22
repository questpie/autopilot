---
name: Testing Strategy
description: How to write and organize tests effectively
roles: [developer, reviewer]
---

# Testing Strategy

Tests are not about proving code works. They are about enabling change. Good tests let you refactor with confidence, catch regressions before users do, and serve as living documentation of expected behavior.

---

## 1. Test Types

### Unit Tests

**What they test:** A single function, class, or module in isolation.

**When to use:**
- Pure business logic (calculations, transformations, validations)
- Utility functions
- State machines and complex conditional logic

**When NOT to use:**
- Simple pass-through functions (no logic to test)
- Code that is primarily glue between systems (test with integration tests instead)

**Characteristics:**
- Fast (< 10ms per test)
- No I/O (no database, no network, no filesystem)
- No shared state between tests
- External dependencies are mocked or stubbed

```typescript
// Good unit test candidate: pure business logic
function calculateDiscount(items: CartItem[], coupon?: Coupon): number {
  // complex discount rules...
}

describe('calculateDiscount', () => {
  it('applies percentage coupon to subtotal', () => {
    const items = [{ price: 100, quantity: 2 }];
    const coupon = { type: 'percentage', value: 10 };
    expect(calculateDiscount(items, coupon)).toBe(20);
  });

  it('caps discount at item total', () => {
    const items = [{ price: 50, quantity: 1 }];
    const coupon = { type: 'fixed', value: 100 };
    expect(calculateDiscount(items, coupon)).toBe(50);
  });

  it('returns 0 when no coupon provided', () => {
    const items = [{ price: 100, quantity: 1 }];
    expect(calculateDiscount(items)).toBe(0);
  });
});
```

### Integration Tests

**What they test:** Multiple components working together, including real I/O.

**When to use:**
- API endpoints (full request/response cycle)
- Database operations (queries, transactions, migrations)
- Service interactions (service A calls service B)
- Middleware chains

**When NOT to use:**
- Testing pure logic (unit tests are faster and more precise)
- Full user workflows (use e2e tests)

**Characteristics:**
- Moderate speed (100ms - 5s per test)
- Uses real databases (test database, reset between tests)
- May use real HTTP (supertest/fetch against test server)
- External services are typically mocked at the network boundary

```typescript
describe('POST /api/orders', () => {
  beforeEach(async () => {
    await db.delete(orders); // clean state
    await db.insert(users).values(testUser);
  });

  it('creates an order and returns 201', async () => {
    const response = await app.request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({
        items: [{ productId: 'prod_1', quantity: 2 }],
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.order.status).toBe('pending');
    expect(body.order.items).toHaveLength(1);

    // Verify side effects
    const saved = await db.select().from(orders).where(eq(orders.id, body.order.id));
    expect(saved).toHaveLength(1);
  });

  it('returns 400 for empty cart', async () => {
    const response = await app.request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testToken}` },
      body: JSON.stringify({ items: [] }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('at least one item');
  });

  it('returns 401 without auth', async () => {
    const response = await app.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items: [{ productId: 'prod_1', quantity: 1 }] }),
    });

    expect(response.status).toBe(401);
  });
});
```

### End-to-End (E2E) Tests

**What they test:** Complete user workflows through the real system.

**When to use:**
- Critical business flows (signup, checkout, payment)
- Flows that span multiple services
- Smoke tests for deployment verification

**When NOT to use:**
- Edge cases (too slow and brittle; use unit/integration tests)
- Non-critical paths
- Every possible permutation

**Characteristics:**
- Slow (5s - 60s per test)
- Uses real infrastructure (or close to it)
- Fragile — keep the suite small and focused
- Aim for 5-15 critical path tests, not 500

---

## 2. Writing Good Tests

### The AAA Pattern

Every test should follow **Arrange, Act, Assert**:

```typescript
it('deactivates user and revokes sessions', async () => {
  // Arrange: set up preconditions
  const user = await createTestUser({ status: 'active' });
  const session = await createTestSession({ userId: user.id });

  // Act: perform the action under test
  await userService.deactivate(user.id);

  // Assert: verify the outcome
  const updated = await getUser(user.id);
  expect(updated.status).toBe('inactive');

  const sessions = await getSessionsByUserId(user.id);
  expect(sessions).toHaveLength(0);
});
```

Separate the three phases visually with blank lines. Never mix them.

### Test Naming

Test names should read like specifications. Someone should understand the expected behavior without reading the test body.

```typescript
// BAD
it('works', () => { });
it('test 1', () => { });
it('handles error', () => { });

// GOOD
it('returns 404 when user does not exist', () => { });
it('retries failed payment up to 3 times', () => { });
it('sends welcome email after successful registration', () => { });
```

Use the pattern: `it('[action] when [condition]')` or `it('should [expected behavior]')`.

### Test Isolation

Each test must be independent. It must not depend on another test running first, and it must not leave state that affects other tests.

```typescript
// BAD: shared mutable state
let counter = 0;
it('increments', () => { counter++; expect(counter).toBe(1); });
it('increments again', () => { counter++; expect(counter).toBe(2); }); // fragile

// GOOD: each test creates its own state
it('increments from zero', () => {
  const counter = new Counter(0);
  counter.increment();
  expect(counter.value).toBe(1);
});
```

For database tests, use one of these strategies:
1. **Truncate tables** in `beforeEach` (simple, slightly slow)
2. **Transaction rollback** — wrap each test in a transaction and roll back after (fast, but tricky with connection pools)
3. **Unique test data** — use random IDs so tests don't collide (good for parallel tests)

### Mocking Guidelines

**Mock at boundaries, not everywhere.**

Good things to mock:
- External HTTP APIs (payment providers, email services)
- Clock/time (`vi.useFakeTimers()`)
- Random number generation (when determinism matters)
- File system (when testing logic, not I/O)

Bad things to mock:
- Your own code (if you're mocking half your app, the test is worthless)
- Database (for integration tests — use a real test database)
- Things that are easy to set up for real

```typescript
// GOOD: mock external boundary
vi.mock('../lib/stripe', () => ({
  createCharge: vi.fn().mockResolvedValue({ id: 'ch_test', status: 'succeeded' }),
}));

// BAD: mocking your own internals
vi.mock('../services/order-service', () => ({
  calculateTotal: vi.fn().mockReturnValue(100),
  validateItems: vi.fn().mockReturnValue(true),
  // you're now testing nothing
}));
```

### Testing Error Cases

Error cases are more important to test than happy paths. The happy path usually works because you wrote it that way. Errors are where bugs hide.

```typescript
describe('transferFunds', () => {
  it('throws InsufficientFundsError when balance is too low', async () => {
    const account = await createAccount({ balance: 50 });
    await expect(transferFunds(account.id, 100))
      .rejects.toThrow(InsufficientFundsError);
  });

  it('rolls back on partial failure', async () => {
    const sender = await createAccount({ balance: 100 });
    const receiver = await createAccount({ balance: 0 });

    // Mock receiver's bank to fail
    vi.spyOn(externalBank, 'credit').mockRejectedValue(new Error('Bank offline'));

    await expect(transferFunds(sender.id, receiver.id, 50)).rejects.toThrow();

    // Verify sender's balance was NOT debited
    const updated = await getAccount(sender.id);
    expect(updated.balance).toBe(100);
  });
});
```

---

## 3. Coverage Targets

### What to Aim For

| Category | Target | Rationale |
|----------|--------|-----------|
| Business logic / domain services | 90%+ | High value, easy to test |
| API routes / controllers | 80%+ | Integration tests cover these |
| Utility functions | 90%+ | Pure functions are trivial to test |
| Database queries | 70%+ | Integration tests with real DB |
| UI components | 60%+ | Diminishing returns beyond this |
| Configuration / glue code | Don't measure | Not worth testing directly |

### What to Skip

Do not write tests for:
- **Generated code** (ORM models, GraphQL types)
- **Simple getters/setters** with no logic
- **Framework boilerplate** (app.listen, middleware registration)
- **Type-only code** (interfaces, type definitions)
- **One-line delegation** functions that just call another function

### Coverage as a Guide, Not a Goal

100% coverage does not mean 100% correct. Coverage tells you which lines were *executed*, not which behaviors were *verified*. A test that calls a function but makes no assertions adds coverage but no value.

Use coverage to find **untested areas**, not as a quality metric.

```bash
# Run tests with coverage
bun test --coverage

# Look for uncovered branches in critical code
# Focus on: services/, lib/, utils/
# Ignore: types/, generated/, config/
```

---

## 4. Test Organization

### File Structure

Place test files next to the code they test:

```
src/
  services/
    order-service.ts
    order-service.test.ts       # unit tests
  routes/
    orders.ts
    orders.integration.test.ts  # integration tests
tests/
  e2e/
    checkout-flow.test.ts       # e2e tests
  fixtures/
    test-user.ts                # shared test data factories
  helpers/
    test-db.ts                  # database setup/teardown
    test-server.ts              # test server setup
```

### Test Data Factories

Create factory functions for test data instead of copying objects everywhere:

```typescript
// tests/fixtures/test-user.ts
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    name: 'Test User',
    email: `test-${randomUUID()}@example.com`,
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

// Usage in tests
const admin = createTestUser({ role: 'admin' });
const inactive = createTestUser({ status: 'inactive' });
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific file
bun test src/services/order-service.test.ts

# Run tests matching a pattern
bun test --grep "order"

# Run in watch mode during development
bun test --watch
```
