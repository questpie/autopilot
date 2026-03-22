---
name: Security Checklist
description: Security review checklist for code and infrastructure
roles: [reviewer, devops, developer]
---

# Security Checklist

Security is not a feature — it is a constraint that applies to everything you build. Most security vulnerabilities are not sophisticated attacks; they are simple mistakes: unsanitized input, missing authorization checks, leaked credentials. This checklist helps you catch the common ones.

---

## 1. OWASP Top 10

The Open Web Application Security Project (OWASP) Top 10 represents the most critical web application security risks. Know them and check for them.

### A01: Broken Access Control

The most common vulnerability. Users can act outside their intended permissions.

**Check for:**
- [ ] Every endpoint verifies the user has permission to access the specific resource (not just "is authenticated")
- [ ] Users cannot access other users' data by changing an ID in the URL
- [ ] Admin endpoints are protected by role checks, not just by being "hidden"
- [ ] API responses do not include fields the user should not see
- [ ] File uploads are restricted to allowed types and stored outside the web root

```typescript
// BAD: only checks authentication, not authorization
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await db.select().from(orders).where(eq(orders.id, req.params.id));
  res.json(order); // Any authenticated user can see any order
});

// GOOD: checks that the user owns the resource
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await db.select().from(orders)
    .where(and(eq(orders.id, req.params.id), eq(orders.userId, req.user.id)));
  if (!order.length) return res.status(404).json({ error: 'Not found' });
  res.json(order[0]);
});
```

### A02: Cryptographic Failures

Sensitive data exposed due to weak or missing encryption.

**Check for:**
- [ ] Passwords are hashed with bcrypt/argon2 (not MD5/SHA1)
- [ ] HTTPS is enforced everywhere (HSTS headers set)
- [ ] Sensitive data is encrypted at rest (database-level or field-level)
- [ ] API keys and tokens have sufficient entropy (min 256 bits)
- [ ] Old/weak TLS versions are disabled (TLS 1.0/1.1)

### A03: Injection

Untrusted data sent to an interpreter as part of a command or query.

**Check for:**
- [ ] SQL queries use parameterized statements, never string concatenation
- [ ] NoSQL queries use typed parameters
- [ ] Shell commands are avoided; if necessary, arguments are escaped
- [ ] LDAP, XPath, and other query languages use proper parameterization
- [ ] Template engines auto-escape output by default

```typescript
// BAD: SQL injection
const users = await db.execute(`SELECT * FROM users WHERE name = '${name}'`);

// GOOD: parameterized query
const users = await db.select().from(usersTable).where(eq(usersTable.name, name));

// GOOD: raw with parameter binding
const users = await db.execute(sql`SELECT * FROM users WHERE name = ${name}`);
```

### A04: Insecure Design

Flaws in the design itself, not just the implementation.

**Check for:**
- [ ] Rate limiting on authentication endpoints
- [ ] Account lockout after failed login attempts
- [ ] Password reset tokens expire (< 1 hour)
- [ ] Business logic cannot be bypassed (e.g., skipping payment step)
- [ ] Sensitive operations require re-authentication

### A05: Security Misconfiguration

Default configurations, unnecessary features, or overly permissive settings.

**Check for:**
- [ ] Default credentials are changed
- [ ] Debug mode is disabled in production
- [ ] Directory listings are disabled
- [ ] Stack traces are not sent to clients in production
- [ ] Unnecessary HTTP methods are disabled (TRACE, OPTIONS where not needed)
- [ ] Security headers are set (see below)

### A06: Vulnerable and Outdated Components

Using libraries with known vulnerabilities.

**Check for:**
- [ ] Dependencies are regularly updated
- [ ] `bun audit` / `npm audit` is run in CI
- [ ] No dependencies with critical CVEs
- [ ] Abandoned/unmaintained dependencies are replaced

### A07: Identification and Authentication Failures

Weak authentication mechanisms.

**Check for:**
- [ ] Multi-factor authentication is available for sensitive accounts
- [ ] Session tokens are rotated after login
- [ ] Sessions expire after inactivity (max 24 hours)
- [ ] Passwords meet minimum requirements (min 8 chars, complexity)
- [ ] Brute force protection is in place

### A08: Software and Data Integrity Failures

Code and infrastructure that doesn't verify integrity.

**Check for:**
- [ ] CI/CD pipeline has integrity checks
- [ ] Dependencies are fetched from trusted sources
- [ ] Lock files are committed and verified
- [ ] Deserialization of untrusted data is avoided

### A09: Security Logging and Monitoring Failures

Inability to detect or respond to breaches.

**Check for:**
- [ ] Authentication events are logged (login, logout, failed attempts)
- [ ] Authorization failures are logged
- [ ] Input validation failures are logged
- [ ] Logs do NOT contain sensitive data (passwords, tokens, PII)
- [ ] Alerting is configured for suspicious patterns

### A10: Server-Side Request Forgery (SSRF)

The server makes requests to unintended locations based on user input.

**Check for:**
- [ ] User-supplied URLs are validated against an allowlist
- [ ] Internal network addresses are blocked (127.0.0.1, 10.x, 192.168.x, etc.)
- [ ] URL redirects do not follow arbitrary redirects
- [ ] Webhook URLs are validated

---

## 2. Input Validation

### Validate at the Boundary

Every piece of data that enters your system from outside must be validated. Use zod or similar schema validation.

```typescript
import { z } from 'zod';

const userInputSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(320).toLowerCase(),
  age: z.number().int().min(0).max(150).optional(),
  bio: z.string().max(5000).optional(),
  website: z.string().url().optional(),
});
```

### Validation Rules

- **Strings:** Set max length on every string field. Unbounded strings are a DoS vector.
- **Numbers:** Set min/max ranges. Check for integer vs. float.
- **Arrays:** Set max length. Validate each element.
- **Objects:** Only allow known properties. Reject extra fields.
- **Files:** Validate type, size, and content (not just the extension).
- **URLs:** Validate scheme (only http/https), host (no internal IPs), and path.

---

## 3. Authentication

### Token Best Practices

- JWTs should be short-lived (15 minutes). Use refresh tokens for longer sessions.
- Store tokens in httpOnly, secure cookies. Never in localStorage.
- Include a `jti` (JWT ID) claim for revocation.
- Rotate signing keys periodically.

### Password Storage

```typescript
import { hash, verify } from '@node-rs/argon2';

// Hashing a password
const hashed = await hash(password, {
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 4,
});

// Verifying a password
const isValid = await verify(hashed, password);
```

Never:
- Store passwords in plaintext
- Use MD5, SHA1, or SHA256 for passwords (they're too fast)
- Implement your own password hashing algorithm
- Log passwords, even hashed ones

---

## 4. Authorization

### Principle of Least Privilege

Every user, service, and process should have only the permissions it needs.

```typescript
// Define permissions explicitly
const PERMISSIONS = {
  'orders:read': ['user', 'admin'],
  'orders:write': ['user', 'admin'],
  'orders:delete': ['admin'],
  'users:manage': ['admin'],
} as const;

function authorize(permission: keyof typeof PERMISSIONS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN' } });
    }
    next();
  };
}

// Usage
app.delete('/api/orders/:id', auth, authorize('orders:delete'), deleteOrder);
```

### Common Authorization Mistakes

| Mistake | Fix |
|---------|-----|
| Checking auth only on the frontend | Always check on the backend |
| Using user-supplied IDs without ownership check | Verify the resource belongs to the user |
| Relying on obscurity (hard-to-guess URLs) | Always enforce access control |
| Checking role but not resource ownership | Check both: "Is this user an editor AND do they own this document?" |

---

## 5. Secrets Management

### Rules

1. **Never commit secrets to git.** Not even in private repos. Not even "temporarily."
2. **Use environment variables** for runtime secrets.
3. **Use a secrets manager** (Vault, AWS Secrets Manager, Doppler) for production.
4. **Rotate secrets regularly** — at least annually, immediately if compromised.
5. **Different secrets per environment.** Dev, staging, and production must not share secrets.

### .gitignore for Secrets

```gitignore
# Secrets and credentials
.env
.env.*
!.env.example
*.pem
*.key
credentials.json
service-account.json
```

### Environment Variable Validation

Validate that required secrets are present at startup, not at first use:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  SMTP_PASSWORD: z.string().min(1),
});

// Fail fast at startup
export const env = envSchema.parse(process.env);
```

### Secret Rotation Checklist

When a secret is compromised:
- [ ] Generate new secret immediately
- [ ] Update all services that use the secret
- [ ] Revoke the old secret
- [ ] Audit logs for unauthorized usage of the old secret
- [ ] Investigate how the secret was leaked
- [ ] Add preventive measures (git hooks, scanning)

---

## 6. Dependency Scanning

### Automated Scanning

```bash
# Check for known vulnerabilities
bun audit

# Use a dedicated scanner for deeper analysis
npx better-npm-audit audit
```

### Pre-Commit Hook for Secrets

Use a tool like `gitleaks` or `detect-secrets` to prevent accidental commits:

```bash
# Install gitleaks
brew install gitleaks

# Run as a pre-commit check
gitleaks detect --source . --verbose
```

---

## 7. Security Headers

Set these headers on every HTTP response:

```typescript
app.use((req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Strict Transport Security (HTTPS only)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Prevent browsers from caching sensitive responses
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  next();
});
```

---

## 8. Security Review Checklist

Before shipping any feature, verify:

- [ ] All user inputs are validated and sanitized
- [ ] Authentication is required on all non-public endpoints
- [ ] Authorization checks verify resource ownership
- [ ] Secrets are not hardcoded or logged
- [ ] SQL queries use parameterized statements
- [ ] Error messages do not leak internal details
- [ ] Security headers are set
- [ ] Dependencies have no known critical vulnerabilities
- [ ] Sensitive data is encrypted in transit and at rest
- [ ] Logging captures security events without sensitive data
