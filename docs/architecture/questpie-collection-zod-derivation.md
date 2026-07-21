# QUESTPIE Collection → Zod Derivation for Shared Form/Route Validation

Status: **Investigation + recommendation**
Audited: **2026-07-21**
Application baseline: **QUESTPIE 3.16.0**, **Zod 4.4.3** (`apps/operator-web` requires `zod@^4.2.1`, resolves to `4.4.3`)
Framework source: `/Users/drepkovsky/questpie/repos/questpie-cms` at `68d68227614addb307133a6294c34d20de143771` on `feat/framework-prerabka-v1`
Note: `apps/operator-web/node_modules/questpie` is a **symlink** to `questpie-cms/packages/questpie`, so all `src/…` citations below are the exact code this app runs. The public docs endpoint `https://questpie.com/llms-full.txt` returned HTTP 500 during this audit; findings are grounded in installed source and `zod.dev`, which are the stronger authority.

## Question

Can we derive/emit **one Zod schema per QUESTPIE collection** so a single validation truth is shared between server routes and client forms (react-hook-form + `zodResolver`)? Or must we hand-write?

## TL;DR

- **QUESTPIE already builds Zod internally**, per field and per collection (create + update shapes). It is the server-side source of truth for CRUD validation.
- **Nothing hands a client a runtime Zod schema today.** The only client-reachable validation artifact is **JSON Schema** (not Zod), fetched over HTTP from the access-gated introspection endpoint — unusable as a static, pre-auth form contract.
- **Emitting client-safe Zod per collection via codegen is feasible** (Zod v4 is a framework hard-dep and the `@questpie/admin` "admin-client" target proves a client-safe generated file is a supported extension point). But it is **framework-owned upstream work**, and it targets the wrong seam for *this* app.
- **Our mutations go through custom `route().schema(zod)` commands, not raw collection CRUD.** The command input Zod — app-owned domain meaning — is the correct single truth. **Recommendation: hand-written client-safe command contracts, import-shared into both `route().schema()` and `zodResolver`.** Zero framework change, no round-trip, works pre-auth.

---

## 1. Does QUESTPIE build Zod schemas internally from field factories today?

**Yes — definitively, and reachable server-side.**

Every field factory (`f.text()`, `f.number()`, `f.relation()`, …) produces a `Field` whose runtime state carries all refinements. `Field` exposes a public **`toZodSchema()`**:

- `questpie-cms/packages/questpie/src/server/fields/field-class.ts:427` — `toZodSchema(): ZodType { return buildZodFromState(this._state); }`
- `questpie-cms/packages/questpie/src/server/fields/derive-schema.ts:63` — `buildZodFromState(state)` maps type → base Zod (`text/email/url/select → z.string()`, `number → z.number()`, `date/datetime/time → z.union([z.string(), z.date()])`, `relation/upload → z.string().uuid()`, `json/object → z.unknown()`), then applies refinements (`maxLength/minLength/pattern/min/max/positive/int/step`, `email()`, `url()`), the user's `.zod()` transform, array wrapping (`minItems/maxItems`), nullability (`notNull` → required else `.nullish()`), and optionality for defaults / `input: "optional"`.

Collection-level create/update schemas are composed from those field schemas:

- `questpie-cms/packages/questpie/src/server/collection/builder/field-schema-builder.ts:37` — `buildFieldBasedSchema(fieldDefs, "insert" | "update")` calls each field's `toZodSchema()`, **skips `input === false`** fields (`:45`), and in `"update"` mode makes every field `.optional()` (`:53`). `"insert"` respects `input: "optional"` (`:58`).
- `:206` — `buildCollectionSchemas(fieldDefs)` returns `{ insertSchema, updateSchema, belongsToMappings }` (both `.passthrough()` to allow nested-relation mutations). **These are exactly the row-level create/update Zod shapes forms need.**

**Reachability:** `field.toZodSchema()` and `buildCollectionSchemas()` are public but **server-only** — they operate on evaluated `Field` objects that live in the server runtime graph. No public export hands the raw `ZodType` to a client bundle. Importing a collection file to reach them pulls in `drizzle-orm`, server field classes, etc. (not client-safe).

**`f.from()` / `.zod()` bypass:** `derive-schema.ts:65` uses an explicit `state.schemaFactory()` when a field was defined with an explicit schema (`f.from(...)`); otherwise it auto-derives. `.zod((s) => …)` (`field-class.ts:246`) refines the auto-derived schema and its output type flows into the field's `data` type. So auto-derivation is the default; explicit schemas are the escape hatch.

## 2. Any existing way to get a runtime validation schema for a collection on the CLIENT?

**Yes, but it is JSON Schema over HTTP — not Zod, not static, and access-gated.** Hand-writing is the only current option for a static, pre-auth form contract.

Introspection converts the internal Zod to **JSON Schema** via Zod v4's `z.toJSONSchema()`:

- `questpie-cms/packages/questpie/src/server/collection/introspection.ts:862` — builds `insertSchema`/`updateSchema` and emits `validation: { insert: z.toJSONSchema(insertSchema), update: z.toJSONSchema(updateSchema) }`. Per-field JSON Schema is also emitted at `:793` (`z.toJSONSchema(fieldDef.toZodSchema())`). The `CollectionSchema.validation` doc comment (`:105`) is explicit: *"JSON Schema for client-side validation. Generated from Zod schemas via `z.toJSONSchema()`. Contains only synchronous, portable validation rules. Async/DB validations happen server-side only."*

Exposed as an HTTP route and surfaced on the client SDK:

- Route: `questpie-cms/packages/questpie/src/server/modules/core/routes/[collection]/schema.ts` → `GET /[collection]/schema`.
- Handler: `server/adapters/routes/collections.ts:731` calls `introspectCollection(...)` and **`:742` returns nothing unless `schema.access.visible`** — the schema is per-user access-gated.
- Client SDK: `server`-typed `createClient<AppConfig>()` gives every collection a `schema(): Promise<CollectionSchema>` (`client/index.ts:686`) implemented as `request(\`${apiBasePath}/${collectionName}/schema\`)` (`:1444`). The `CollectionSchema` type (incl. `validation.insert/update`) is re-exported for admin consumption (`:1912`).

**Why this is not a forms contract:** (a) it is **JSON Schema**, so `zodResolver` cannot consume it (you would need an ajv/standard-schema resolver or a JSON-Schema→Zod conversion); (b) it is an **async HTTP round-trip** at form-init time; (c) it is **access-gated**, so unauthenticated forms (sign-in, sign-up, invitation acceptance) get nothing; (d) it validates the **full document** shape, not a command's curated input. It exists for the admin panel's dynamic form renderer, not for hand-authored feature forms.

## 3. Is emitting Zod per collection via codegen feasible, and how hard? (create/update shapes)

**Feasible, moderate effort, framework-owned. Zod v4 is JSON-serializable and a hard dependency, and a client-safe generated target already exists as precedent.**

Zod v4 serialization is real and shipping in the installed version:

- `z.toJSONSchema()` is present at `node_modules/.bun/zod@4.4.3/node_modules/zod/v4/core/to-json-schema.js` and is already called in framework introspection.
- Per `zod.dev/json-schema`: `z.toJSONSchema()` is **core, stable**, introduced in **Zod 3.23.0** and carried into v4; options include `target` (draft-04/07/2020-12/openapi-3.0), `io: "input" | "output"`, `unrepresentable: "throw" | "any"`, and `override`. Unrepresentable types (`z.date()`, `z.transform()`, `z.custom()`, …) throw by default. The reverse `z.fromJSONSchema()` exists but is **explicitly experimental / not part of the stable API** — so a JSON-Schema→Zod round-trip is not a safe foundation.

The codegen extension point that makes client-safe emission possible:

- Default target is `"server"` (`cli/codegen/index.ts:456`), which emits the runtime `index.ts` (imports `createApp` — **server-only**; see `apps/operator-web/src/questpie/server/.generated/index.ts:5,145`).
- `@questpie/admin` declares a **second, client-safe target `"admin-client"`** (`questpie-cms/packages/admin/src/server/plugin.ts:333`) with `outputFile: "client.ts"` and a custom `generate: (ctx) => generateAdminClientTemplate(ctx)` (`:467`). It emits a `.generated/client.ts` importing only client-safe packages + type-level maps. **This is the exact template for a per-collection Zod emitter.** Plugin surface is documented in the `codegen-plugin-api.md` skill reference (`CodegenTargetContribution.generate` / `targets` keyed by target id).

Two viable emission strategies (both produce a pure-data / pure-Zod, client-safe module):

1. **Emit Zod source directly (best DX).** Port `buildZodFromState` (`derive-schema.ts`) from a *builder* to a *string emitter*: the field state it reads (`maxLength`, `min`, `pattern.source`, `type`, `notNull`, `input`, …) is fully serializable, so `f.text(255).required()` emits the string `z.string().max(255)`. Output: `.generated/contracts.ts` that does `import { z } from "zod"` and `export const companiesInsert = z.object({…})`. Real Zod → works directly with `zodResolver`, typed via `z.infer`.
2. **Emit JSON Schema snapshot (lowest new code).** Reuse `buildCollectionSchemas` + `z.toJSONSchema` (already written) at build time and write the JSON literals into a client-safe file; consume with an ajv resolver. Avoids a new emitter but does not give you Zod/`zodResolver`.

**Effort driver / the one real constraint:** codegen is *file/source-scan* based — the `transform`/`generate` hooks receive discovered file **source and import paths**, not evaluated `Field` objects (see the admin-client `transform` at `plugin.ts:392`, which wires imports and type maps, never evaluating a collection). To read field state, a custom `generate` must **dynamically import + evaluate each collection at build time** (fine in the Node CLI; collection modules import server/drizzle code, but only the emitted Zod/JSON — pure data — ships to the client). Create/update are free: `buildCollectionSchemas` already yields both, `update` all-optional, `input:false` fields dropped.

## 4. Type-safety of emitted schemas — do they simply mirror the inferred types?

**Mostly yes for the "no second hand-maintained type" concern; but not a byte-exact mirror of `CollectionDoc`.**

The collection's TS types (`CollectionDoc<K>`, builder-inferred insert/update — see `type-inference.md`, and `apps/operator-web/src/questpie/server/.generated/index.ts:87,98`) and the derived Zod **come from the same field definitions**. An emitted runtime schema is derived from that same state, so you are **not** introducing a separately hand-maintained static type that can drift — `z.infer<typeof emitted>` is generated, not written. **Confirmed: no separate static-typing problem in the "hand-rolled mirror" sense.**

**Refuted, however, is the idea that it is an exact mirror.** `derive-schema.ts` is deliberately **validation-lossy** relative to the precise TS types: `json`/`object` → `z.unknown()`, `date/datetime/time` → `z.union([z.string(), z.date()])`, `relation`/`upload` → `z.string().uuid()`. So `z.infer<emitted>` is looser than `CollectionDoc<K>`/the builder insert type for those fields (`.$type<T>()` and `.zod()` narrow the *TS* type but the auto-derived *runtime* schema does not always follow). For form input validation this looseness is correct and harmless (forms validate incoming values, not full typed documents), but an emitted schema should not be advertised as type-identical to `CollectionDoc`.

## 5. `route().schema()` vs collection validation

Two **different** mechanisms — this distinction drives the recommendation:

- **Collection validation** is *auto-derived* from fields (`buildCollectionSchemas`, §1) and describes the full row create/update shape.
- **`route().schema()`** takes an *explicit, hand-authored* Zod: `schema<TInput>(schema: z.ZodSchema<TInput>)` (`questpie-cms/packages/questpie/src/server/routes/route-builder.ts:187`). It is arbitrary — not tied to any collection — and is the server-side input gate for a custom typed command. Its type is inferred into the handler and available standalone as `InferRouteInput<typeof def>` (type-only; `type-inference.md` rows 8–9). The runtime Zod object itself is **server-side** (importing the route file client-side drags the handler).

**This app validates writes through custom command routes, not raw collection CRUD.** Example: `apps/operator-web/src/questpie/server/routes/channels/create.ts` gates input with `.schema(commandEnvelopeSchema.extend({ spaceId: z.string(), name: z.string().trim().min(2).max(160) }))`, importing shared pieces from `apps/operator-web/src/questpie/server/domain/organization-route-contract.ts`. The command input (`spaceId` + `name` + `idempotencyKey`) is a **curated subset that never equals the `channels` collection insert shape.** A per-collection emitted schema would therefore be the *wrong* contract for these forms.

---

## Recommendation

**Adopt (c): hand-written, client-safe *command contracts*, import-shared into both `route().schema()` and the form's `zodResolver`.** Keep (b) codegen-emit-Zod as a documented upstream option for the day we render forms directly against collection CRUD.

Rationale, decisive tradeoff, and risk:

- **Decisive tradeoff — right seam beats less machinery.** Because our server writes are typed commands, the validation truth is the *command input* Zod (`route().schema(...)`), which is **app-owned domain meaning** — the capability matrix in `docs/architecture/framework-capability-reuse.md` assigns "typed aggregate commands" to the Autopilot seam. A per-collection derived schema (even a perfect one) validates the full document, not the command, so it would not be reused by these forms anyway. Sharing the command Zod is both lower-machinery **and** the correct seam.
- **The shared object makes server==client by construction.** `route().schema(x)` and `useForm({ resolver: zodResolver(x) })` referencing the **same** imported Zod object are byte-identical — no drift between the server gate and the client form.
- **Biggest risk — contract vs. collection drift** (a command field referencing a collection field that was renamed/removed). This is *not* caught by sharing the Zod (the collection is a different shape); it is caught downstream by the route handler's typed `services`/`collections` calls at compile time, and can be reinforced with a light test asserting command-contract compatibility against `CollectionDoc<K>` where a command field does map 1:1.
- **Framework vs app-local.** Recommendation (c) is **app-local and allowed** — command shapes are app domain meaning. Recommendation (b), if ever pursued, is a **framework (`questpie-cms`) change**, per the binding rule in `framework-capability-reuse.md` ("a generic missing capability is implemented and tested in `questpie-cms`, released through the package train … never hidden behind an app-local replacement"). Do **not** hand-roll an app-local per-collection Zod emitter; if we need derived collection Zod on the client, add an upstream codegen target modeled on `admin-client` and consume it.
- **Introspection (a) is not the forms contract.** `client.collection().schema()` stays useful for admin/dynamic rendering, but its JSON-Schema-over-HTTP, access-gated, full-document nature disqualifies it for hand-authored, pre-auth feature forms.

### What it means for our forms guideline (delta)

- The `src/contracts/` fallback is **the primary approach, not a fallback**, for command-style forms. (It does not yet exist on disk as of this audit — `find … -type d -name contracts` returns nothing.)
- Contracts must be **pure-Zod, client-safe**: import `zod` only. Note that `domain/organization-route-contract.ts` already holds the command Zod but also imports `questpie/errors` (`ApiError`) and `Request`-parsing helpers — **split the pure schemas into a zod-only module** (e.g. `src/contracts/organization.ts`) so client forms can import them without dragging server code; the route keeps importing the same schemas plus its server helpers.
- Each mutation defines **one** exported Zod (create and, where relevant, update). The route imports it into `.schema()`; the feature-folder form imports the same object into `zodResolver`. One object, two consumers.
- Prefer `z.infer<typeof contract>` for the form's value type over `CollectionDoc<K>` — the command input is intentionally a subset of the document.
- If a future surface renders forms directly against collection CRUD (admin-style), revisit recommendation (b): an upstream `questpie-cms` codegen target that emits client-safe per-collection `insert`/`update` Zod (strategy §3.1), modeled on the existing `admin-client` target — not an app-local emitter.
