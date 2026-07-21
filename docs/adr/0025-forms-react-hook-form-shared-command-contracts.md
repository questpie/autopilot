# ADR 0025: Forms use react-hook-form over shared Zod command contracts

- Status: accepted
- Date: 2026-07-21

## Context

Forms in operator-web are hand-rolled with `useState` and no client-side validation; they submit and handle the server's error outcome. Zod is used heavily on the server in typed route schemas (`route().schema(z.object(...))`), which are the write-validation truth. Writes go through **typed command routes** (curated input subsets), not raw collection CRUD.

The kit has no form binding (`packages/ui/src/components/ui/form.tsx` does not exist). QUESTPIE does build Zod internally per field and per collection (`field.toZodSchema()`, `buildCollectionSchemas()` → `insertSchema`/`updateSchema`), but that is server-only; the only client-reachable artifact is a full-document JSON Schema via an async, auth-gated introspection endpoint — unusable as a static, pre-auth form contract. See `docs/architecture/questpie-collection-zod-derivation.md`.

## Decision

- Forms use **react-hook-form** with **`@hookform/resolvers`** (`zodResolver`). The packages are installed when the first real form adopts them.
- For a QUESTPIE-command-backed form, the validation truth is the **command input schema** (the typed route's `.schema`), **not** a collection document schema — writes flow through commands, whose input is a curated subset.
- That command Zod schema lives in a **client-safe contract module** (pure `zod`, no server imports) imported by **both** the server route `.schema()` and the client form. The two derive from ONE source, not a duplicate: the server validates the full command schema; the form validates its **user-input subset** (`.pick`/`.omit` of the same object, dropping the command-envelope `idempotencyKey` and any server-set ids — those are not form fields). Existing mixed `*-route-contract.ts` files (which import `questpie/errors` and hold `requireSession` / cookie readers) are split so the schema part is pure-Zod and client-safe.
- The contract lives at a neutral client-safe seam **outside `src/questpie/server/`** (so the client bundle never crosses into codegen/server code), reachable by both the QUESTPIE command routes (`src/questpie/server/routes/<x>.ts`, which call `route().schema(...)`) and the client forms (today in `src/components/screens/`, moving to `src/features/<name>/`) — e.g. `src/contracts/<command>.ts`; the exact path is settled at implementation. (`src/routes/` is the TanStack page tree, not where command schemas live.)
- **Better-Auth-backed forms are a carve-out.** Sign-in / sign-up / password forms call Better Auth (`authClient.*`) directly — no QUESTPIE command route, so no shared server Zod object exists. Their form schema is a small client-owned auth-input schema (email format, password length, name) mirroring the configured Better Auth policy. This is NOT the rejected "client re-declares its own schemas" (which means duplicating a schema that already lives server-side); here no server Zod exists to share, so the shared-contract rule simply does not apply.
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
