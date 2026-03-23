---
name: release-notes
description: |
  How to write clear release notes and changelogs
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [release, documentation]
  roles: [marketing, developer]
---

# Release Notes

Release notes are the primary communication channel between your engineering team and your users. Good release notes build trust, reduce support tickets, and help users get value from new features. Bad release notes are either ignored or cause confusion.

---

## 1. Format

### Standard Release Note Structure

```markdown
# v2.4.0 — 2024-01-15

## Highlights
Brief paragraph (2-3 sentences) summarizing the most important changes
in this release. Written for a non-technical audience.

## New Features
### Invoice Export
You can now export your invoices as PDF or CSV from the Billing page.
Select the date range and format, then click "Export."

### Bulk User Import
Admins can upload a CSV file to create multiple users at once.
Download the template from Settings > Users > Import.

## Improvements
- **Dashboard loading speed** — The main dashboard now loads 40% faster
  thanks to optimized data fetching.
- **Search relevance** — Search results are now ranked by relevance
  instead of alphabetical order.
- **Mobile navigation** — The sidebar menu now collapses properly on
  small screens.

## Bug Fixes
- Fixed an issue where password reset emails were not sent for accounts
  with uppercase email addresses.
- Fixed a rare crash when viewing a project with no tasks.
- Fixed incorrect timezone display for users in UTC+13 and UTC+14.

## Breaking Changes
- **API:** The `GET /api/users` endpoint now returns paginated results
  by default (50 per page). Clients that expect all results in a single
  response must update to use pagination. See [migration guide](/docs/migration).
- **Config:** The `DATABASE_URL` environment variable is now required.
  Previously it defaulted to `localhost:5432`.

## Deprecations
- The `POST /api/users/search` endpoint is deprecated and will be
  removed in v3.0. Use `GET /api/users?q=search_term` instead.

## Security
- Updated dependency `lodash` from 4.17.20 to 4.17.21 to address
  CVE-2021-23337 (prototype pollution).

## Migration Notes
If upgrading from v2.3.x, run the database migration before deploying:
```bash
bun run db:migrate
```
No other manual steps are required.
```

---

## 2. Categorization

### Category Definitions

| Category | What Goes Here | Audience |
|----------|---------------|----------|
| **Highlights** | The 1-3 most impactful changes | Everyone |
| **New Features** | Entirely new capabilities | Users, product team |
| **Improvements** | Enhancements to existing features | Users |
| **Bug Fixes** | Corrected incorrect behavior | Users, support |
| **Breaking Changes** | Changes that require user/client action | Developers, ops |
| **Deprecations** | Features being phased out | Developers |
| **Security** | Security patches and updates | Security team, ops |
| **Migration Notes** | Steps needed to upgrade | Ops, developers |
| **Internal** | Refactoring, tooling, CI changes | Not in public notes |

### What NOT to Include in Public Release Notes

- Internal refactoring ("Migrated to new ORM")
- CI/CD changes ("Updated GitHub Actions workflow")
- Code style changes ("Ran prettier on all files")
- Dependency bumps without security implications
- Test additions or fixes (unless they indicate a fixed bug)

These go in the internal changelog (CHANGELOG.md in the repo) but not in user-facing release notes.

---

## 3. Writing Tips

### Know Your Audience

Write for the person who uses your product, not the person who builds it.

```
# BAD (developer-speak)
- Refactored the order saga to use event sourcing with CQRS pattern,
  replacing the legacy synchronous transaction handler.

# GOOD (user-speak)
- Order processing is now more reliable. Orders will no longer
  occasionally appear as "stuck" during high traffic.
```

### Lead with the Benefit

Tell users what they can do, not what you did.

```
# BAD (what you did)
- Added a caching layer to the dashboard API endpoint.

# GOOD (what they get)
- The dashboard now loads 40% faster.
```

### Be Specific

Vague release notes are useless. Include enough detail to be actionable.

```
# BAD
- Fixed a bug with exports.

# GOOD
- Fixed an issue where CSV exports would fail for reports containing
  more than 10,000 rows. Large exports now process in the background
  and you will receive an email when the file is ready.
```

### Use Active Voice

```
# BAD (passive)
- A new filtering option has been added to the search page.

# GOOD (active)
- You can now filter search results by date range.
```

### Breaking Changes Need Migration Paths

Never announce a breaking change without telling users how to adapt.

```
# BAD
- Changed the API response format for /api/users.

# GOOD
- **Breaking:** The `GET /api/users` response now wraps results in a
  `data` array: `{ "data": [...] }`. Previously, the endpoint returned
  a bare array. Update your client code to access `response.data`
  instead of using the response directly.
```

### Group Related Changes

If you made three improvements to the same feature, group them:

```
# BAD (scattered)
- Improved search speed
- Added search filters for date
- Fixed search crash on special characters

# GOOD (grouped)
### Search Improvements
- Search results now return 3x faster
- You can filter results by date range
- Fixed a crash when searching for terms containing special characters
```

---

## 4. Examples

### Feature Launch Release Note

```markdown
## New: Team Workspaces

You can now organize your projects into team workspaces. Each workspace
has its own members, permissions, and billing.

**What's included:**
- Create unlimited workspaces from Settings > Workspaces
- Invite members with Owner, Admin, or Member roles
- Move existing projects between workspaces
- Separate billing per workspace

**Getting started:**
Your existing projects have been moved to a "Default" workspace.
No action is needed unless you want to create additional workspaces.

[Read the full guide](/docs/workspaces)
```

### Bug Fix Release Note

```markdown
## Bug Fixes

- **File uploads:** Fixed an issue where uploading files larger than
  25MB would fail silently. Large uploads now show a progress bar and
  proper error messages if the upload fails.
- **Notifications:** Email notifications for task assignments were not
  being sent to users with custom email domains. This has been fixed.
- **Timezone handling:** Scheduled reports now correctly use the
  timezone set in your profile instead of defaulting to UTC.
```

### Security Release Note

```markdown
## Security Update

This release includes an important security fix. We recommend all users
update immediately.

- **Authentication:** Fixed a vulnerability where session tokens were
  not properly invalidated after password changes. After upgrading,
  all existing sessions will be invalidated and users will need to
  log in again.

If you believe your account may have been affected, contact
security@example.com.
```

---

## 5. Changelog vs. Release Notes

| | Changelog (CHANGELOG.md) | Release Notes (public) |
|-|--------------------------|----------------------|
| **Audience** | Developers | Users |
| **Detail level** | Technical | User-focused |
| **Includes internal changes** | Yes | No |
| **Format** | Keep a Changelog | Custom, audience-appropriate |
| **Stored in** | Git repository | Blog, in-app, email |

### Keep a Changelog Format (CHANGELOG.md)

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Invoice export as PDF/CSV (#234)
- Bulk user import via CSV (#245)

### Changed
- Dashboard API now returns paginated results (#251)
- Search results ranked by relevance instead of alphabetically (#248)

### Fixed
- Password reset for uppercase emails (#239)
- Crash when viewing project with no tasks (#241)

### Security
- Updated lodash to 4.17.21 (CVE-2021-23337)

## [2.3.0] - 2024-01-01

### Added
...
```

---

## 6. Release Note Checklist

Before publishing, verify:

- [ ] Highlights section summarizes the most important changes
- [ ] All user-facing changes are documented
- [ ] Breaking changes have migration instructions
- [ ] Language is clear and jargon-free
- [ ] Each item leads with the user benefit
- [ ] Bug fixes describe the symptom, not just the fix
- [ ] Security updates include severity and recommended action
- [ ] Links to documentation are included where helpful
- [ ] The notes have been proofread for grammar and clarity
- [ ] Internal-only changes are excluded from public notes
