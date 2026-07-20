---
status: proposed
---

# Slovak-first localization uses the installed QUESTPIE locale chain and typed copy modules

Autopilot v2 is Slovak-first and will localize both data and UI. The 2026-07-20 research grill (two researchers, two adversarial reviews, synthesis; all claims verified against installed questpie 3.16.0 source) ratified: the backend adopts the framework's existing locale chain wholesale and builds nothing new — `.localized()` fields with i18n side-tables and fallback merge, `LocaleConfig` pinned to `sk` in the app config bucket, per-request locale negotiation propagated by AsyncLocalStorage, the locale baked into every generated query key (already live as `?locale=sk`), `app.t` with the framework's built-in Slovak catalog, the codegen-typed `messages/` convention, auto-localized zod field errors and ApiError message keys, and the mailer's `locale` surface. Frontend UI strings live in typed per-feature copy modules (`apps/operator-web/src/copy/<feature>.ts`, `as const` objects; strings reach `@questpie/ui` components as props), guarded by a lint script against new hardcoded copy, with zero i18n dependencies.

## Considered options

- i18next/react-i18next and Lingui were rejected: the highest concept count, the weakest typed-key story (i18next degrades to `string` on non-const keys), the heaviest toolchain (Lingui's Babel/macro chain), and a runtime provider that would leak into the presentation-pure kit.
- paraglide-js 2.22.0 was verified compatible now (Vite `>=5` peer satisfies Vite 8; official TanStack Start guide in TanStack CI) and deliberately deferred: adoption is gated on a committed second UI locale, and at that fork an upstream-first alternative — exporting the framework's own simple i18n (admin `createSimpleI18n` / server `MessagesShape` idiom) as an app-facing surface — must be evaluated first per the AGENTS.md upstream-first rule.

## Consequences

- Per-person locale persistence and any locale-switching UI are out of scope until a second language is committed; the Company record is where a future Company Language choice lives.
- The better-auth verification/reset email bridge remains a must-build in questpie-cms (framework-capability-reuse deviation 2); sign-in slices scope around it honestly until it lands.
- Seeded System Content display names become Slovak product copy while their systemKeys and slugs stay stable English identifiers that contracts, fixtures, and tests bind to.

## Amendment (2026-07-20, owner-ratified)

Locale addition must be purely horizontal — translations only, never an infrastructure step. Therefore:

- Copy modules are per-locale from day one: `src/copy/shape.ts` derives the canonical `CopyShape` from the Slovak modules, every other locale `satisfies` that shape (a missing key is a compile error — catalog completeness enforced by the type system), and `getCopy(locale)` selects the bundle by Company Language. Adding a language means adding one folder of translation files.
- Intl helpers are locale-bound per locale folder (`src/copy/<locale>/intl.ts` produced by a shared `createIntl(locale)` factory covering plural rules, date, and number formatting); no shared module hardcodes a locale literal — the literal appears exactly once per locale folder.
- The `@questpie/ui` kit becomes locale-agnostic: the Slovak defaults in its 37 text-bearing components are extracted into app copy modules and supplied through required text props (or neutral non-textual defaults). Adding a language never touches the kit.
- The earlier second-locale fork (paraglide versus an upstream simple-i18n export) is no longer a required migration; it remains only an optional future optimization if compile-time message tooling is ever genuinely needed.

## Amendment 2 (2026-07-20, owner-ratified — SUPERSEDES the props-only kit-copy mechanism above)

Detection by diacritics is wrong (e.g. "Detail behu" has none yet is hardcoded UI copy) and props-threading every string through text-heavy components (RunCard and the whole `ai/` presentation surface — 16 files, the heaviest copy consumer) is too heavy. The FE mechanism is a **translate function**, not copy props.

- **Mechanism = `useT()`**, reusing the framework's existing client i18n (`createSimpleI18n` / `useT` / `useTranslation` / `TranslationsProvider` in `questpie-cms/packages/admin/src/client/i18n`) — no third-party dependency. Components resolve copy by key: `const t = useT(); t("runCard.openDetail")`. This supersedes the props-only kit-copy extraction: the kit is no longer parametrised string-by-string.
- **Home = `packages/ui`, not a separate `packages/i18n`.** Per the owner's rule a separate shared lib is warranted only if the backend consumes the same catalog; the backend localises server-emitted messages through the framework's SERVER i18n (`app.t`, `messages/`, `.localized()`, zod field errors, ApiError message keys, mailer locale) — a separate concern with its own catalog. So the FE catalog is FE-only and lives in the shared `@questpie/ui` package that both the kit and the app already consume.
- **Kit purity preserved by a fallback:** the kit's `useT` reads from a React i18n context whose default returns a key/English identity, so kit components (RunCard etc.) still render standalone in Storybook and tests without any provider; the app wraps `TranslationsProvider` with the Slovak catalog. The kit imports its own i18n context, never an app provider.
- **Per-locale catalogs** keep the day-one horizontal shape from Amendment 1 (canonical `CopyShape`, `satisfies` completeness, `Intl.PluralRules`/`Intl.*Format` per locale), but authored as message maps keyed by id rather than as-const objects passed as props.
- **Detection = "not via `t()`", not diacritics:** the `lint-no-hardcoded-copy` guard flags any user-facing string (JSX text nodes and `label`/`aria-label`/`placeholder`/`title`/`alt` props) that is not resolved through `t()`/`useT()`, across `packages/ui` and the app. Seed it with a baseline allowlist of the ~103 existing strings so it fails only on NEW hardcoded copy (stops the growth) while the bulk migration proceeds incrementally.

## Upstream gap

The framework's client i18n currently lives in `packages/admin` (marked "reference, not reused" in AGENTS.md). Reusing it requires lifting `createSimpleI18n`/`useT`/`useTranslation`/`TranslationsProvider` into a reusable framework export (e.g. a `questpie` client i18n entry) rather than importing from `admin`. Upstream-first per the symlinked framework; verify the exact export before implementation.
