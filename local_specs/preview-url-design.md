# Durable Preview URLs for Dogfood Delivery

## Architecture

Preview = inline artifacts stored on orchestrator + served via orchestrator endpoint.

```
Worker (laptop)                          Orchestrator (VPS)
─────────────────                        ──────────────────
1. Claude writes src/index.html          
2. Run completes                         
3. Worker reads changed files            
   from worktree                         
4. Sends them as inline artifacts  ───►  5. Stores in artifacts table
   in RunCompletion                         (ref_kind: 'inline')
5. Worktree cleaned up                   6. Creates preview_url artifact
6. Worker can go offline                    pointing to own endpoint
                                         7. Operator opens:
                                            GET /api/previews/:runId/src/index.html
                                            → serves from DB, no worker needed
```

### Why this is correct

- **Durable:** content is in the DB on the orchestrator
- **Survives worker offline:** orchestrator serves from its own DB
- **Same model everywhere:** local orchestrator = localhost, VPS = vps-url. Same artifact, same endpoint.
- **No new storage system:** uses existing artifacts table with `ref_kind: 'inline'`
- **No new upload API:** uses existing RunCompletion.artifacts pipeline
- **~50 lines total** (worker file reading + orchestrator serving endpoint)

### What it's not

- Not a CDN or hosting platform
- Not a build system (vanilla HTML only)
- Not for large binary assets (images) — text files only for now
- Not a live dev server

## Data flow

### Step 1: Worker reads changed files at completion

After Claude finishes and before reporting completion, the worker:

1. Runs `git diff --name-only <base>..HEAD` in the worktree to find changed files
2. Reads each file's content
3. Adds them as artifacts in the RunCompletion payload:

```typescript
// In worker executeRun(), after adapter.start() returns:
artifacts: [
  // ...artifacts from structured output parser (existing)
  // ...preview files from worktree (new)
  {
    kind: 'preview_file',
    title: 'src/index.html',        // relative path = lookup key
    ref_kind: 'inline',
    ref_value: '<html>...',          // file content
    mime_type: 'text/html',
  },
  {
    kind: 'preview_file',
    title: 'src/styles.css',
    ref_kind: 'inline',
    ref_value: '* { margin: 0; }...', 
    mime_type: 'text/css',
  },
]
```

**Which files:** All files from `git diff --name-only`. For a landing page, that's 2-3 files.

**Size limit:** Skip files > 500KB. Landing page HTML+CSS is < 50KB total.

### Step 2: Orchestrator stores them

Already implemented. The run completion handler in `routes/runs.ts` iterates
`body.artifacts` and inserts each into the `artifacts` table. No changes needed
to the storage path.

### Step 3: Orchestrator creates preview_url artifact

After storing preview_file artifacts, the orchestrator checks if any
`preview_file` artifacts were stored. If so, it creates one `preview_url`
artifact pointing to its own serve endpoint.

Entry point detection: look for `index.html` among the preview files.
If found, the preview URL points to it. Otherwise, use the first file.

```typescript
{
  kind: 'preview_url',
  title: 'Preview',
  ref_kind: 'url',
  ref_value: `${orchestratorOrigin}/api/previews/${runId}/src/index.html`,
  mime_type: 'text/html',
  metadata: { run_id: runId, entry: 'src/index.html' },
}
```

### Step 4: Orchestrator serves preview files

New endpoint on the orchestrator API:

```
GET /api/previews/:runId/*path
```

Implementation:
1. Look up artifact where `run_id = :runId` AND `kind = 'preview_file'` AND `title = :path`
2. If found, return `ref_value` with `Content-Type` from `mime_type`
3. If not found, return 404

Current implementation uses the same user-auth model as tasks and artifact inspection.

That means:

- local dev can still use the local bypass path where explicitly allowed
- VPS/self-hosted use stays behind normal orchestrator auth
- true public/shareable publishing is a later concern, not part of this pass

## Artifact model

### preview_file (new kind)

Stores the actual file content durably on the orchestrator.

| Field | Value |
|-------|-------|
| kind | `preview_file` |
| title | Relative file path (e.g., `src/index.html`) |
| ref_kind | `inline` |
| ref_value | File content (text) |
| mime_type | `text/html`, `text/css`, etc. |
| run_id | The run that produced the file |
| task_id | The task |

### preview_url (existing kind)

Points to the orchestrator's serve endpoint.

| Field | Value |
|-------|-------|
| kind | `preview_url` |
| title | `Preview` |
| ref_kind | `url` |
| ref_value | `http://<orchestrator>/api/previews/<runId>/src/index.html` |
| run_id | The run that produced the file |
| task_id | The task |

## Local vs VPS semantics

| Environment | preview_url ref_value |
|-------------|----------------------|
| Local | `http://localhost:7778/api/previews/run-xxx/src/index.html` |
| VPS | `https://autopilot.acme.com/api/previews/run-xxx/src/index.html` |

Same artifact shape. Same endpoint. Different origin.

The orchestrator needs to know its own public URL to generate the preview_url.
This can come from env var (e.g., `ORCHESTRATOR_URL`) or from the request's
`Host` header at creation time.

Important:

- durable preview survives worker shutdown
- preview does not imply public publishing
- if public/share links are wanted later, that should be added as a separate access/publishing concern

## What changes where

### Spec (`packages/spec`)

- Add `preview_file` to `ArtifactKindSchema` enum

### Worker (`packages/worker`)

- In `executeRun()`: after adapter completes, read changed files from worktree
  and append them as `preview_file` artifacts to the completion payload
- Helper: `readPreviewFiles(worktreePath, repoRoot)` — runs git diff, reads files,
  returns artifact array

### Orchestrator (`packages/orchestrator`)

- New route: `GET /api/previews/:runId/*path` — serves preview_file artifacts
- In run completion handler: after storing artifacts, if preview_files exist,
  auto-create a `preview_url` artifact

### Workflow config

No changes needed. The worker reads changed files from git diff automatically.
Optional future: `preview.entry` field on steps to hint entry point.

## Size constraints

For the dogfood landing-page case:

- HTML file: ~3-5 KB
- CSS file: ~5-10 KB
- Total: < 50 KB per preview
- Stored as text in SQLite `ref_value` column — no issue

Skip files that are:
- Binary (images, fonts) — detected by extension or content sniffing
- Larger than 500 KB
- In `.git/`, `node_modules/`, `.worktrees/`

## Implementation estimate

~2-3 hours:
- Add `preview_file` kind to spec (5 min)
- Worker: read changed files at completion (30 min)
- Orchestrator: preview serving endpoint (30 min)
- Orchestrator: auto-create preview_url at completion (20 min)
- Tests (30 min)
- Proving with Acme landing page (30 min)
