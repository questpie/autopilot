# ADR 0016: TanStack Start owns theme state

- Status: accepted for Phase 0
- Date: 2026-07-19

## Context

The shadcn Sonner registry item added `next-themes`, but operator-web is a TanStack Start application. Importing a Next-specific theme hook into `packages/ui` also reverses the desired dependency direction: the reusable UI package would own application/document state.

The accepted reference is WellDone2094's TanStack Start ThemeProvider gist. Its important mechanisms are a pre-hydration theme script, a client context, local-storage persistence, system preference observation, cross-tab synchronization, and `suppressHydrationWarning` on the document root. The implementation must be adapted to current repository lint, accessibility, CSP, and module boundaries rather than copied without review.

## Decision

- Theme state lives in `apps/operator-web/src/lib/theme` and is mounted by the TanStack Start root document.
- The root document owns `<html>`, `<head>`, `<body>`, the pre-hydration theme script, Provider, themed Toaster, and `<Scripts />`. Page routes render page content only.
- The persisted preference is `light | dark | system`; the DOM receives a resolved `light | dark` value through the `.dark` class, `data-theme`, and `color-scheme` before hydration.
- `packages/ui` has no dependency on `next-themes` or any application theme context. Components such as Toaster accept the standard resolved theme prop from the app boundary.
- The provider handles unavailable local storage, system preference changes, cross-tab preference changes, transition suppression, and hydration consistency.

## Consequences

- Dark/light CSS and native control color scheme agree before first paint.
- Storybook can control its own document theme without importing operator-web.
- Theme persistence and SSR behavior are testable independently from product pages.
- `next-themes` is absent from operator-web and `packages/ui` manifests and imports. QUESTPIE 3.16.0 still brings it into the lockfile transitively through `@questpie/admin`; that unrelated framework dependency is not used for Autopilot theme state and should be separated upstream rather than patched around in the application.

## Reference

- https://gist.github.com/WellDone2094/16107a2a9476b28a5b394bee3fa1b8a3
