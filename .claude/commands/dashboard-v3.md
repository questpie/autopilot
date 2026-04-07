# Dashboard v3 Implementation

Maintenance-first reset of the QuestPie Dashboard. Not a feature-maximalist rebuild — a clean, minimal, stable foundation for incremental development.

## Specs

All specs: `local_specs/dashboard-v3/`. Read first:
- `00-architecture.md` — structure, phases, migration matrix
- `00-ui-primitives.md` — available shadcn/Base UI components
- `CHANGELOG-v3-review.md` — review fixes applied

## Skills to Load

Before each phase, load relevant skills:
```
/tanstack-start-best-practices
/tanstack-router-best-practices
/shadcn
/tailwindcss-mobile-first
```

After implementation: `/deslop`

Note: Only use skills that are actually available in the current environment. Check `/help` for available skills.

## Key Rules

0. **Interaction minimalism.** Every interactive element must answer: what user job does this solve? Is it core MVP? What breaks without it? No dead-end controls. No "coming soon". No duplicate entrypoints.
1. **One component = one file.** Export component + props type.
2. **URL is source of truth.** No redundant UI state in stores. Derive from pathname.
3. **Reuse existing primitives.** `@/components/ui/*`, `@questpie/avatar`, `@/lib/motion`.
4. **No `as` casts, no empty catch, no silent fallbacks.**
5. **`useSuspenseQuery` + Suspense** for data loading.
6. **Backend API: `/api/chat-sessions`** (NOT `/api/sessions` — that's auth sessions).
7. **Minimal design.** No glows/grids in content areas. Clean surfaces, clear typography. Motion only for orientation.
8. **Migration, not rewrite.** Keep what works (SSE hook, auth, query client, UI primitives). Replace what's broken.
9. **Each phase must leave app working.** Verify before moving on.

## Phases

### Phase 0+1: Strip + Shell
**Spec:** `01-strip-and-shell.md` + `01a` through `01f`
**Do:** Delete features, build CompactSidebar + SecondarySidebar + SidebarSection + SplitLayout + EmptyState + routes.
**Verify:** Onboarding works, 3 sections navigate, empty states render.

### Phase 2: AI Chat + Onboarding
**Spec:** `02-ai-chat.md` + `02a-onboarding-to-chat.md` + `02b-references-and-mentions.md`
**Do:** Backend fix (`POST /api/chat-sessions`), chat primitives, onboarding simplification (no templates, CEO agent setup).
**Verify:** AI conversation with streaming + tool calls, session resumes on reload.

### Phase 3: Channels + DMs
**Spec:** `03-channels-and-dms.md` + `03a-user-invites.md`
**Do:** Reuse chat primitives for group messaging. Basic @mentions, threads (Sheet side panel), invite dialog.
**Verify:** Send messages in channels, @mention agents, invite people.

### Phase 4: Workflow + Inbox + Settings
**Spec:** `05-workflow.md` + `05a-inbox-and-notifications.md` + `04a-artifacts-and-dashboard.md` (settings)
**Do:** Task list/detail, minimal inbox (bell + popover), settings/general (providers, models).
**Note:** Reordered — workflow before FS because users need to see agent work first.
**Verify:** Tasks CRUD, inbox shows actionable items, settings save.

### Phase 5: FS (read-first)
**Spec:** `04-fs.md` + `04a-artifacts-and-dashboard.md`
**Do:** File tree, viewer with view registry, basic context menu (create, delete, pattern-matched creates). Read-first. Write only for existing editable views.
**Deferred:** rename, move, duplicate (compose from existing APIs post-MVP).
**Verify:** Browse files, custom views render, create from templates.

### Phase 6: Polish
**Spec:** `06-polish.md`
**Do:** Command palette, keyboard shortcuts, remaining settings, mobile cleanup.
**Verify:** Cmd+K works, shortcuts work, mobile usable.

## Migration Matrix

| Area | Strategy |
|------|----------|
| Auth, setup wizard | keep / refactor |
| UI primitives (shadcn) | keep |
| Brand components | keep |
| SSE hook, query client, API client | keep |
| App shell, sidebar | replace |
| Chat components | replace (new session-first) |
| FS components | replace (new view registry) |
| Settings | refactor |
| Notifications | new |
| Workflow | new |

## Argument

`$ARGUMENTS` = phase number (0-6). Reads relevant specs and starts implementing.
