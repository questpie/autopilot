---
name: API Design
description: REST API design patterns and conventions
roles: [developer, planner]
---

# API Design

A well-designed API is the most important interface in your system. It outlives the code behind it. Frontend clients, mobile apps, third-party integrations, and future developers will all depend on the contracts you define. Get them right early.

---

## 1. URL Conventions

### Resource-Oriented URLs

URLs represent resources (nouns), not actions (verbs). Use the HTTP method to express the action.

```
# GOOD — resource-oriented
GET    /api/users
GET    /api/users/123
POST   /api/users
PATCH  /api/users/123
DELETE /api/users/123

# BAD — action-oriented
GET    /api/getUsers
POST   /api/createUser
POST   /api/deleteUser/123
```

### Naming Rules

- Use **plural nouns** for collections: `/users`, `/orders`, `/invoices`
- Use **kebab-case** for multi-word resources: `/order-items`, `/payment-methods`
- Use **path nesting** for ownership relationships: `/users/123/orders`
- Keep nesting shallow — max 2 levels: `/users/123/orders` is fine, `/users/123/orders/456/items/789/tags` is not
- Use query parameters for filtering, not URL segments: `/orders?status=pending`, not `/orders/pending`

### Versioning in URLs

```
/api/v1/users
/api/v2/users
```

Version when you make breaking changes. Do not version for additive changes (new fields, new endpoints). Support at least one previous version for 6 months after deprecation.

---

## 2. HTTP Methods

| Method | Purpose | Idempotent | Request Body | Success Code |
|--------|---------|------------|--------------|--------------|
| `GET` | Retrieve resource(s) | Yes | No | 200 |
| `POST` | Create a resource | No | Yes | 201 |
| `PUT` | Full replacement of a resource | Yes | Yes | 200 |
| `PATCH` | Partial update of a resource | Yes* | Yes | 200 |
| `DELETE` | Remove a resource | Yes | No | 204 |

*PATCH is idempotent if you apply the same patch to the same state.

### Method Selection Guide

- **Retrieving data?** Use `GET`. Never use `POST` for reads (except complex search queries that exceed URL length limits).
- **Creating something new?** Use `POST`. Return 201 with the created resource and a `Location` header.
- **Updating a few fields?** Use `PATCH`. Send only the fields that changed.
- **Replacing entirely?** Use `PUT`. The request body is the complete new state.
- **Deleting?** Use `DELETE`. Return 204 (no content). Make it idempotent — deleting an already-deleted resource returns 204, not 404.

---

## 3. Request and Response Design

### Request Bodies

Always validate with a schema. Use zod at the API boundary.

```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
});

type CreateUserInput = z.infer<typeof createUserSchema>;
```

### Response Envelope

Use a consistent response shape for all endpoints:

```typescript
// Success (single resource)
{
  "data": {
    "id": "usr_123",
    "name": "Alice",
    "email": "alice@example.com"
  }
}

// Success (collection)
{
  "data": [
    { "id": "usr_123", "name": "Alice" },
    { "id": "usr_456", "name": "Bob" }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "hasMore": true
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Must be a valid email address" }
    ]
  }
}
```

### Field Naming

- Use **camelCase** for JSON fields: `createdAt`, `firstName`, `orderId`
- Use **ISO 8601** for dates: `"2024-01-15T10:30:00Z"`
- Use **strings for IDs**, even if they're numeric internally: `"id": "123"`, not `"id": 123`
- Include `createdAt` and `updatedAt` on all resources
- Use prefixed IDs when possible: `usr_123`, `ord_456`, `inv_789`

---

## 4. Error Handling

### HTTP Status Codes

Use the right status code. Do not return 200 for errors.

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST that creates a resource |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input (validation error) |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate resource, version conflict |
| 422 | Unprocessable Entity | Valid syntax but semantic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |

### Error Response Structure

```typescript
interface ApiError {
  error: {
    code: string;         // Machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
    message: string;      // Human-readable: "User not found"
    details?: unknown[];  // Optional: field-level errors, debug info
    requestId?: string;   // For support/debugging
  };
}
```

### Error Codes

Define a finite set of error codes. Do not invent new ones ad-hoc.

```typescript
const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;
```

### Never Leak Internals

```typescript
// BAD: exposes stack trace and database details
{
  "error": "TypeError: Cannot read property 'id' of undefined\n    at Object.<anonymous> (/app/src/services/user.ts:42:15)"
}

// GOOD: safe for external consumption
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again.",
    "requestId": "req_abc123"
  }
}
```

Log the full error server-side. Return only safe information to the client.

---

## 5. Pagination

### Offset-Based Pagination

Simple and widely understood. Works well for most use cases.

```
GET /api/users?page=2&limit=50
```

```typescript
// Implementation
const page = Math.max(1, parseInt(req.query.page ?? '1'));
const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '50')));
const offset = (page - 1) * limit;

const [data, total] = await Promise.all([
  db.select().from(users).limit(limit).offset(offset).orderBy(users.createdAt),
  db.select({ count: count() }).from(users),
]);

return {
  data,
  pagination: { page, limit, total: total[0].count, hasMore: offset + limit < total[0].count },
};
```

### Cursor-Based Pagination

Better for large datasets, real-time feeds, and infinite scroll. Prevents issues with items shifting between pages.

```
GET /api/events?cursor=evt_abc123&limit=50
```

```typescript
const cursor = req.query.cursor;
const limit = Math.min(100, parseInt(req.query.limit ?? '50'));

const query = db.select().from(events).orderBy(desc(events.createdAt)).limit(limit + 1);

if (cursor) {
  const cursorRecord = await db.select({ createdAt: events.createdAt })
    .from(events).where(eq(events.id, cursor)).limit(1);
  if (cursorRecord.length) {
    query.where(lt(events.createdAt, cursorRecord[0].createdAt));
  }
}

const results = await query;
const hasMore = results.length > limit;
const data = hasMore ? results.slice(0, -1) : results;

return {
  data,
  pagination: {
    nextCursor: hasMore ? data[data.length - 1].id : null,
    hasMore,
  },
};
```

### Defaults and Limits

- Default page size: 50
- Maximum page size: 100
- Always enforce a maximum — never let clients request unlimited results
- Always return pagination metadata in the response

---

## 6. Authentication

### Bearer Token Pattern

```
Authorization: Bearer <token>
```

Validate the token in middleware, not in individual handlers:

```typescript
async function authMiddleware(req: Request): Promise<AuthContext> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError('AUTHENTICATION_REQUIRED', 'Missing or invalid Authorization header');
  }

  const token = header.slice(7);
  const payload = await verifyToken(token);

  return { userId: payload.sub, roles: payload.roles };
}
```

### API Keys

For server-to-server communication. Send in a header, never in the URL.

```
X-API-Key: sk_live_abc123
```

Prefix keys to indicate their type:
- `sk_live_` — live secret key
- `sk_test_` — test secret key
- `pk_live_` — live publishable key

---

## 7. Rate Limiting

Always rate limit public endpoints. Return standard headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
Retry-After: 60
```

When a client exceeds the limit, return `429 Too Many Requests` with a `Retry-After` header.

Typical limits:
- Public unauthenticated: 30 requests/minute
- Authenticated user: 300 requests/minute
- Admin/service: 1000 requests/minute
- Heavy endpoints (search, export): 10 requests/minute

---

## 8. Idempotency

For non-idempotent operations (POST), accept an `Idempotency-Key` header:

```
POST /api/payments
Idempotency-Key: idem_unique_client_key_123
```

If the server receives the same idempotency key twice, return the original response. This prevents duplicate charges, duplicate orders, etc.

Store idempotency keys for at least 24 hours.

---

## 9. API Design Checklist

Before shipping a new endpoint, verify:

- [ ] URL follows resource naming conventions
- [ ] HTTP method is correct
- [ ] Request body is validated with a schema
- [ ] Response follows the standard envelope format
- [ ] Error responses use correct status codes and error codes
- [ ] Pagination is implemented for list endpoints
- [ ] Authentication is required (or explicitly opted out)
- [ ] Rate limiting is configured
- [ ] The endpoint is documented (OpenAPI or equivalent)
- [ ] Integration tests cover happy path and key error cases
