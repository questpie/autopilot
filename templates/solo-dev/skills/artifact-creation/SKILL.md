---
name: artifact-creation
description: |
  How to create live previews (artifacts) for mockups, landing pages, demos, and docs.
  Use when a task requires a visual or interactive output that humans need to review.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [artifacts, preview, ui, demo]
  roles: [developer, design]
---

# Artifact Creation

Create live previews that humans can see and interact with in the dashboard or browser.

---

## When to Create an Artifact

- UI mockup or prototype that needs visual review
- Landing page draft for feedback
- Demo app to validate an approach
- Documentation site (API docs, guides)
- Email template preview
- Any output where "seeing it" is better than describing it

**Do NOT create artifacts for:** code libraries, backend services, database migrations, or anything that doesn't have a visual component.

---

## create_artifact Usage

### React Artifact (full Vite + React app)

```typescript
create_artifact({
  name: "pricing-page-v2",
  type: "react",
  files: {
    "src/App.tsx": `
      export default function App() {
        return (
          <div className="min-h-screen bg-black text-white p-8">
            <h1 className="text-4xl font-bold">Pricing</h1>
            <div className="grid grid-cols-3 gap-6 mt-8">
              {/* pricing cards */}
            </div>
          </div>
        )
      }
    `,
    "src/main.tsx": `
      import { createRoot } from 'react-dom/client'
      import App from './App'
      createRoot(document.getElementById('root')!).render(<App />)
    `
  }
})
```

### HTML Artifact (single page, no build)

```typescript
create_artifact({
  name: "email-welcome",
  type: "html",
  files: {
    "index.html": `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h1>Welcome to QUESTPIE</h1>
          <p>Your company OS is ready.</p>
        </body>
      </html>
    `
  }
})
```

### Static Artifact (pre-built files)

```typescript
create_artifact({
  name: "api-docs",
  type: "static",
  files: {
    "index.html": "<!DOCTYPE html>...",
    "openapi.json": "{ ... }",
    "styles.css": "body { ... }"
  }
})
```

---

## .artifact.yaml

Every artifact directory needs this config file:

```yaml
name: pricing-page-v2
serve: "bun run dev --port {port}"    # {port} replaced by router
build: "bun install"                   # Run once before first serve
health: "/"                            # Health check path
timeout: 5m                            # Idle timeout before shutdown
```

The artifact router reads this file and manages the dev server process automatically. Port is allocated from pool 4100-4199.

---

## Pinning to Dashboard

After creating the artifact, pin it so the human can find it:

```typescript
pin_to_board({
  group: "artifacts",
  title: "Pricing Page v2",
  type: "info",
  content: "Live preview ready — click to review",
  metadata: {
    url: "http://localhost:4100",
    type: "react",
    task_id: "task-052"
  }
})
```

---

## Best Practices

- **Keep artifacts focused** — one concept per artifact, not a full app
- **Use the design system** — import brand colors and fonts from `/knowledge/brand/`
- **Include sample data** — don't show empty states, show realistic content
- **Handle viewport sizes** — test at mobile, tablet, and desktop widths
- **Name descriptively** — `pricing-page-v2` not `test-artifact`
- **Clean up** — stop artifacts you no longer need to free ports
- **Pin with context** — include task_id so the human knows what it relates to
