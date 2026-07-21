# ADR 0025: Forms use react-hook-form over shared Zod command contracts

- Status: accepted
- Date: 2026-07-21

## Context

Forms in operator-web are hand-rolled with `useState` and no client-side validation; they submit and handle the server's error outcome. Zod is used heavily on the server in typed route schemas (`route().schema(z.object(...))`), which are the write-validation truth. Writes go through **typed command routes** (curated input subsets), not raw collection CRUD.

The kit has no form binding (`packages/ui/src/components/ui/form.tsx` does not exist). QUESTPIE does build Zod internally per field and per collection (`field.toZodSchema()`, `buildCollectionSchemas()` → `insertSchema`/`updateSchema`), but that is server-only; the only client-reachable artifact is a full-document JSON Schema via an async, auth-gated introspection endpoint — unusable as a static, pre-auth form contract. See `docs/architecture/questpie-collection-zod-derivation.md`.

## Decision

- Forms use **react-hook-form** with **`@hookform/resolvers`** (`zodResolver`). The packages are installed when the first real form adopts them.
- The validation truth for a form is the **command input schema** (the typed route's `.schema`), **not** a collection document schema — because writes flow through commands, whose input is a curated subset.
- Each command's Zod schema lives in a **client-safe contract module** (pure `zod`, no server imports) and is imported by **both** the server route `.schema()` and the client form `zodResolver`. One object, one truth. Existing mixed `*-route-contract.ts` files (which import `questpie/errors` and hold `requireSession` / cookie readers) are split: server helpers move to server-scoped modules, leaving a pure-Zod contract.
- The contract lives at a neutral client-safe seam reachable by both trees (`src/routes/…` server routes and `src/features/…` client forms) — e.g. `src/contracts/<command>.ts`; the exact path is settled at implementation.
- The kit gains a shadcn **Form** binding (`components/ui/form.tsx`, added via the shadcn CLI) that composes the existing `Field` / `FieldGroup` / Base UI primitives. Forms compose that binding, never a home-grown form API (AGENTS.md UI contract).
- Codegen-emitted Zod per collection (an agnostic `.generated` emit) is a possible **future framework capability** — precedent exists in `@questpie/admin`'s client-safe codegen target, and `z.toJSONSchema` is stable in Zod 4 — but it is owned upstream in `questpie-cms` and emits full-document collection schemas, so it does not replace hand-authored command contracts for these forms.

## Consequences

- No client/server validation drift: one Zod object is the schema on both sides.
- The shared contract matches the command/route boundary, which is also the mutation boundary (ADR 0022).
- Forms are consistent over the kit primitives; no parallel form primitive API.
- No framework change is required to ship forms now.

## Rejected alternatives

- **@tanstack/react-form:** on-brand and type-safe, but react-hook-form is the more mature, battle-tested default for a phase-0 product.
- **Derive form schemas from collection full-document schemas:** the wrong shape — forms validate curated command inputs, not whole documents.
- **Client re-declares its own schemas:** guaranteed drift from the server truth.
- **Import server route-contract modules (with server deps) into the client:** leaks `questpie/errors` and server logic into the client bundle.

## Reference

- `docs/architecture/questpie-collection-zod-derivation.md`
- ADR 0022 (command/mutation boundary).
