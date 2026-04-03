# Preview URLs in Dogfood Delivery Flows

## 1. Executive Summary

After the implement step, the operator needs to see the result visually. The minimal model:
the worker API serves files directly from git branches (no worktree needed), and the
orchestrator registers the URL as a `preview_url` artifact. One new endpoint, one new
artifact kind, zero new processes.

## 2. Preview Concept Model

Three distinct concerns:

| Concern | What it is | Who owns it |
|---------|-----------|-------------|
| **File serving** | HTTP endpoint that serves static files from a git branch | Worker API |
| **URL generation** | Knowing which branch + path to serve | Orchestrator (at run completion) |
| **Artifact registration** | Storing the URL as a `preview_url` artifact | Orchestrator |

The preview mechanism is **not** an artifact viewer. It is a file server.
The artifact is **not** the preview — it is a pointer (URL) to the preview.

This separation is the key design decision:

```
implement step completes
  → orchestrator knows: run ID, branch name, project has src/index.html
  → orchestrator registers artifact: { kind: "preview_url", ref_value: "<url>" }
  → operator opens URL in browser
  → worker API serves file from git branch via `git show`
```

## 3. Recommended Minimal Dogfood Preview Path

### Serve files from git branches via the worker API

The worker API already exists (`packages/worker/src/api.ts`) with workspace inspection
endpoints. Add one endpoint:

```
GET /preview/:branch/*path
```

Implementation (pseudocode):
```typescript
app.get('/preview/:branch/*', async (c) => {
  const branch = decodeURIComponent(c.req.param('branch'))
  const filePath = c.req.param('*') || 'index.html'

  // git show <branch>:<path> — works without a worktree
  const proc = Bun.spawn(['git', 'show', `${branch}:${filePath}`], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const content = await new Response(proc.stdout).arrayBuffer()
  const exitCode = await proc.exited

  if (exitCode !== 0) return c.text('Not found', 404)

  // Infer content type from extension
  const ext = filePath.split('.').pop()
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

  return new Response(content, {
    headers: { 'Content-Type': contentType },
  })
})
```

**Why this is the smallest path:**

- No new process to spawn or manage
- No worktree needed — `git show` reads directly from the branch
- Branches survive worktree cleanup (confirmed by workspace.ts release logic)
- Worker API already runs, already has auth and CORS
- Works for HTML, CSS, images, any static file
- ~30 lines of implementation

**Why not alternatives:**

| Alternative | Why not |
|------------|---------|
| `python -m http.server` in worktree | Worktree is cleaned up after run; needs process management |
| Deploy to Vercel/Netlify | Too heavy for local dogfood; adds external dependency |
| Orchestrator serves files | Orchestrator doesn't have access to git repo |
| Dedicated preview step in workflow | Overhead for just serving files; not a workflow concern |
| Post-run webhook action | Correct direction for cloud, but overkill locally |

## 4. Workflow Placement

### Preview URL is registered by the orchestrator at run completion — not a workflow step

The `preview_url` artifact should be created **when the implement run completes successfully**.
Not as a separate workflow step. Not as a post-run action.

**Where in the code:**

In `packages/orchestrator/src/api/routes/runs.ts`, the completion handler already:
1. Saves run result
2. Registers artifacts from the worker
3. Releases worker lease
4. Advances workflow

Add after step 2: if the completing run's workflow step is `implement` (or any step
that produces code), register a `preview_url` artifact pointing to the worker API.

**Why not a dedicated step:**

A "preview" step would create a run, claim a worker, execute... just to generate a URL.
That's a waste. The URL is deterministic from the run ID and branch name.

**Why not a post-run action:**

Post-run actions are for external webhooks (deploy hooks, notifications). A local preview
URL is internal — the orchestrator already knows everything it needs.

**When the operator sees it:**

The preview URL is available as soon as `implement` completes. By the time the task
reaches `review` (human approval), the operator can open the link. The validate-impl
step runs in between, but the implement branch still exists and is servable.

## 5. `preview_url` Artifact Recommendation

```typescript
{
  kind: 'preview_url',
  title: 'Landing Page Preview',
  ref_kind: 'url',
  ref_value: 'http://localhost:7779/preview/autopilot%2Frun-xxx/src/index.html',
  // metadata (optional):
  metadata: {
    branch: 'autopilot/run-xxx',
    entry_path: 'src/index.html',
    worker_origin: 'http://localhost:7779',
  }
}
```

### Shape decisions

| Field | Value | Rationale |
|-------|-------|-----------|
| `kind` | `preview_url` | Distinct from `preview` (which could be a screenshot) |
| `ref_kind` | `url` | Not `inline` or `file` — it's a resolvable URL |
| `ref_value` | Full URL | Operator can open directly |
| `run_id` | Set to the implement run | Tied to the run that produced the code |
| `task_id` | Set to the task | Queryable per task |

### Metadata

- `branch`: the git branch name (for manual `git show` if worker is down)
- `entry_path`: the file path within the branch (e.g. `src/index.html`)
- `worker_origin`: the worker API base URL (lets the app reconstruct URLs)

### How the operator consumes it

1. Via API: `GET /api/runs/:id/artifacts` → find `kind: preview_url` → open `ref_value`
2. Via Worker App (future): artifact panel shows preview URL as a clickable link,
   or embeds it in an iframe
3. Via CLI: `autopilot runs artifacts <runId>` → prints URL

## 6. Local vs Cloud Semantics

### Same model, different URL origin

| Environment | Worker API origin | Preview URL |
|-------------|------------------|-------------|
| Local dogfood | `http://localhost:7779` | `http://localhost:7779/preview/autopilot%2Frun-xxx/src/index.html` |
| VPS/self-hosted | `https://worker.acme.internal:7779` | `https://worker.acme.internal:7779/preview/...` |
| Cloud (future) | Worker behind proxy | `https://preview.autopilot.cloud/w/<worker-id>/preview/...` |

The concept is identical:
- Worker serves files from git branch
- URL is registered as artifact
- Operator opens URL

What changes is only the origin. The `metadata.worker_origin` field in the artifact
makes the URL reconstructable if the worker moves.

### Cloud evolution path

For cloud/multi-worker, the orchestrator would need to know which worker has the repo.
The artifact's `metadata.worker_origin` + the run's `worker_id` provide this.
A proxy/gateway could route `preview.autopilot.cloud/w/:workerId/preview/:branch/*`
to the correct worker. But that's a later concern.

## 7. Landing-Page Proving Example

Concrete flow with Acme Corp:

```
1. Task "Implement landing page" reaches implement step
2. Worker claims run, creates worktree: autopilot/run-abc123
3. Claude implements src/index.html + src/styles.css
4. Claude commits to branch autopilot/run-abc123
5. Run completes → worker reports completion to orchestrator
6. Orchestrator:
   a. Saves run result
   b. Registers artifacts from worker output
   c. Creates preview_url artifact:
      kind: preview_url
      ref_value: http://localhost:7779/preview/autopilot%2Frun-abc123/src/index.html
   d. Advances to validate-impl
7. validate-impl runs, approves → review step
8. Task is blocked at review
9. Operator:
   a. Sees task at review step
   b. Queries artifacts: GET /api/tasks/:id → finds preview_url
   c. Opens http://localhost:7779/preview/autopilot%2Frun-abc123/src/index.html
   d. Sees the rendered Acme Corp landing page in browser
   e. Decides to approve, reply with feedback, or reject
```

**What the operator sees in browser:**

The full rendered landing page — hero, features, testimonials, footer — served as
static HTML+CSS from the git branch. No build step needed. CSS loads via relative
`href="styles.css"` which resolves to the same preview endpoint.

**Relative asset resolution:**

`<link rel="stylesheet" href="styles.css">` in index.html resolves to
`http://localhost:7779/preview/autopilot%2Frun-abc123/src/styles.css`
because the browser resolves relative URLs from the current path. This works
naturally with the `GET /preview/:branch/*path` endpoint.

## 8. Recommended Next Pass

**Implement this as a tiny pass before Worker App Phase A.**

Scope: ~2 hours of work.

1. Add `GET /preview/:branch/*path` endpoint to worker API (~30 lines)
2. Add preview URL artifact registration in orchestrator run completion handler (~20 lines)
3. Test with the existing Acme landing page branch
4. Verify: open URL in browser, see rendered page

**Why before Worker App:**

The Worker App's review panel will want to embed or link to preview URLs. Having the
endpoint ready means the app can use it from day one. The endpoint is also useful
right now for CLI-driven dogfood proving — the operator gets a clickable link.

**Why not defer:**

It's 2 hours of work and makes every subsequent dogfood proving run more useful.
Without it, the operator has to `git checkout` the branch manually to see the result.

**What to skip for now:**

- No automatic entry-path detection (hardcode or pass explicitly)
- No build step (vanilla HTML only — fine for landing pages)
- No screenshot/thumbnail generation
- No iframe embedding in Worker App (that's Phase A/B)
- No cloud proxy routing
