---
name: Git Workflow
description: Git branching strategy and PR conventions
roles: [developer, reviewer, devops]
---

# Git Workflow

A consistent git workflow prevents merge conflicts, keeps history readable, and makes deployments predictable. These conventions are optimized for small teams (1-5 developers) shipping frequently.

---

## 1. Branch Strategy

### Trunk-Based Development (Recommended)

For small teams, trunk-based development is the simplest and most effective strategy. All work merges to `main` (the trunk) through short-lived feature branches.

```
main ──────●──────●──────●──────●──────●──────●──── (always deployable)
            \    /        \    /        \    /
             feat/        feat/         fix/
             login        search        typo
             (1-3 days)   (2 days)      (1 hour)
```

### Branch Naming Conventions

```
feat/short-description     # New feature
fix/short-description      # Bug fix
chore/short-description    # Maintenance, refactoring, tooling
docs/short-description     # Documentation only
spike/short-description    # Exploratory work (may be thrown away)
release/v2.4.0             # Release preparation (if needed)
hotfix/short-description   # Emergency production fix
```

Rules:
- Use **lowercase** and **hyphens** (not underscores or camelCase)
- Keep branch names **short** (under 50 characters)
- Include the **task ID** if you use a tracker: `feat/QUE-123-user-import`
- Delete branches after merge

### Branch Lifecycle

1. Create from latest `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/user-import
   ```

2. Make small, focused commits (see commit conventions below).

3. Push early and often:
   ```bash
   git push -u origin feat/user-import
   ```

4. Open a PR when ready for review (or as a draft for early feedback).

5. After approval, merge to `main` and delete the branch.

### Long-Lived Branches

Avoid long-lived feature branches (> 5 days). They cause:
- Painful merge conflicts
- Delayed feedback
- "Big bang" merges that are hard to review

If a feature takes more than a week, break it into smaller PRs that can merge independently. Use feature flags to hide incomplete work from users.

---

## 2. Commit Messages

### Format

```
<type>(<scope>): <short description>

<optional body — explain why, not what>

<optional footer — references, breaking changes>
```

### Commit Types

| Type | Use When |
|------|----------|
| `feat` | Adding new functionality |
| `fix` | Fixing a bug |
| `refactor` | Restructuring code without changing behavior |
| `chore` | Tooling, build, CI, dependencies |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |
| `style` | Formatting, no code change |

### Examples

```bash
# Feature
feat(auth): add password reset via email

# Bug fix
fix(orders): prevent duplicate order creation on double-click

# Refactor
refactor(billing): extract invoice calculation to separate service

# Chore
chore(deps): update drizzle-orm to v0.30.0

# With body
feat(api): add pagination to user list endpoint

The /api/users endpoint previously returned all users in a single
response, which caused timeouts for organizations with >10k users.
Added cursor-based pagination with a default page size of 50.

Closes QUE-234
```

### Commit Message Rules

1. **Subject line: max 72 characters.** Shorter is better.
2. **Use imperative mood.** "Add feature" not "Added feature" or "Adds feature."
3. **Do not end the subject with a period.**
4. **Separate subject from body with a blank line.**
5. **Body: explain WHY, not WHAT.** The diff shows what changed; the message should say why.
6. **Reference issues** in the footer: `Closes QUE-123` or `Refs QUE-456`.

### Atomic Commits

Each commit should be a single logical change. You should be able to revert any single commit without breaking anything.

```bash
# BAD: one giant commit
"feat: add user import, fix login bug, update dependencies, refactor billing"

# GOOD: separate commits
"feat(users): add CSV import endpoint"
"feat(users): add CSV import UI with drag-and-drop"
"fix(auth): handle expired tokens in login flow"
"chore(deps): update drizzle-orm to v0.30.0"
```

### When to Squash

Squash commits when:
- You have "fix typo" or "WIP" commits that add noise
- Multiple commits implement a single logical change
- The PR is small and a single commit tells the story better

Do NOT squash when:
- Each commit represents a meaningful step
- The PR contains multiple distinct changes (it probably should be split)

---

## 3. PR Template

Use this template for all pull requests:

```markdown
## What

Brief description of the changes. Link to the task/issue.

Closes QUE-XXX

## Why

Why is this change needed? What problem does it solve?

## How

High-level description of the implementation approach.
Mention non-obvious design decisions.

## Testing

How was this tested? Include:
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing steps (if applicable)

## Screenshots

(if there are UI changes)

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] No new warnings or errors
- [ ] Documentation updated (if applicable)
- [ ] Migration is reversible (if applicable)
```

### PR Best Practices

**Size:**
- Aim for **< 300 lines changed** per PR. Smaller PRs get better reviews.
- If a PR is over 500 lines, split it. Exception: generated code, migrations.

**Description:**
- Write the description for someone who has no context.
- Link to the task/issue. Don't make reviewers search for context.
- Explain non-obvious decisions: "I chose X over Y because..."

**Draft PRs:**
- Open a draft PR early for complex features.
- Use it to get directional feedback before investing in polish.
- Convert to "Ready for Review" when it's complete.

**Self-Review:**
- Review your own PR before requesting reviews.
- Read every line of the diff. You will find issues.

---

## 4. Merge Strategy

### Squash and Merge (Default)

For most PRs, use **squash and merge**. This keeps the main branch history clean — one commit per PR.

```
main: ──●──●──●──●──  (clean, linear history)
         ↑  ↑  ↑  ↑
        PR PR PR PR
```

The squashed commit message should be the PR title + a summary of changes.

### Merge Commit (For Large Features)

Use a regular merge commit when the individual commits in the PR tell an important story and you want to preserve them.

### Rebase and Merge (Rarely)

Use rebase when you want individual commits on main without a merge commit. Only appropriate for very clean commit histories.

### Merge Rules

Configure branch protection on `main`:
- [ ] Require at least 1 approval
- [ ] Require CI to pass
- [ ] Require branch to be up to date with main
- [ ] Do not allow force pushes
- [ ] Do not allow deletions

---

## 5. Release Tagging

### Semantic Versioning

Use [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`

| Component | When to Bump | Example |
|-----------|-------------|---------|
| **MAJOR** | Breaking API change | 1.0.0 -> 2.0.0 |
| **MINOR** | New feature (backward compatible) | 1.0.0 -> 1.1.0 |
| **PATCH** | Bug fix (backward compatible) | 1.0.0 -> 1.0.1 |

### Creating a Release

```bash
# Tag the release
git tag -a v2.4.0 -m "Release v2.4.0"
git push origin v2.4.0

# Or create a release via GitHub CLI
gh release create v2.4.0 \
  --title "v2.4.0" \
  --notes "$(cat RELEASE_NOTES.md)" \
  --latest
```

### Pre-Release Tags

```bash
# Alpha (unstable, incomplete)
git tag -a v2.4.0-alpha.1 -m "v2.4.0-alpha.1"

# Beta (feature-complete, not fully tested)
git tag -a v2.4.0-beta.1 -m "v2.4.0-beta.1"

# Release candidate (ready for final testing)
git tag -a v2.4.0-rc.1 -m "v2.4.0-rc.1"
```

---

## 6. Common Git Operations

### Keeping Your Branch Up to Date

```bash
# Rebase on latest main (preferred — clean history)
git fetch origin
git rebase origin/main

# If conflicts arise during rebase
git rebase --abort  # start over
# or resolve conflicts, then:
git add .
git rebase --continue
```

### Undoing Mistakes

```bash
# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Undo last commit (keep changes unstaged)
git reset HEAD~1

# Discard all uncommitted changes (DESTRUCTIVE)
git checkout -- .

# Revert a specific commit (creates a new commit)
git revert <commit-hash>
```

### Stashing Work

```bash
# Save current work
git stash

# Save with a description
git stash push -m "WIP: user import validation"

# List stashes
git stash list

# Apply most recent stash
git stash pop

# Apply a specific stash
git stash pop stash@{2}
```

### Interactive Staging

When a file contains both changes you want to commit and changes you don't:

```bash
# Stage specific hunks
git add -p <file>
# Review each hunk: y (stage), n (skip), s (split)
```

---

## 7. Git Hygiene

### Do

- Pull before pushing
- Commit early and often
- Write meaningful commit messages
- Delete merged branches
- Use `.gitignore` to keep the repo clean

### Do Not

- Commit secrets, credentials, or API keys
- Commit large binary files (use Git LFS or external storage)
- Force push to shared branches
- Rewrite history on branches others are using
- Commit generated files that can be rebuilt (node_modules, dist, .next)

### .gitignore Essentials

```gitignore
# Dependencies
node_modules/
.bun/

# Build output
dist/
.next/
build/

# Environment
.env
.env.*
!.env.example

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Test coverage
coverage/
```
