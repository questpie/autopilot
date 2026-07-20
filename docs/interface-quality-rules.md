# Interface Quality Rules

- Status: binding design-engineering contract
- Visual source: canonical Autopilot operator wireframe board
- Applies to: `@questpie/ui`, Storybook, query-free templates, and product screens
- Related: [`visual-glossary.md`](./visual-glossary.md), [`primitive-mapping.md`](./primitive-mapping.md)

## 1. Template-first prototyping

Templates are the first product-shaped review surface. They use grounded Slovak fixtures and typed, query-free projections so information architecture, density, hierarchy, responsive transitions, and edge states can be reviewed before complex QUESTPIE data wiring exists.

The dependency direction remains strict:

```text
canonical tokens
→ CLI-owned primitives
→ domain-free composites
→ query-free templates with dummy projections
→ TanStack Query + QUESTPIE Channels adapters
→ routes
```

A template may expose typed callbacks and serializable display projections. It must not fetch, mutate, subscribe, know collection clients, or invent a second domain model.

## 2. Shared geometry matrix

Components do not choose independent geometry. The semantic role determines the metric.

| Role | Height | Radius | Type | Notes |
| --- | --- | --- | --- | --- |
| compact action | 27–28px | 10px | 13/16, 600 | dense row action only |
| default button | 32px | 14px | 15/20, 500–600 | `.btn` radius-md; neutral tier is borderless `secondary`, never a border |
| default field | 32px | 10px | 15/20, 500 | Input, Select trigger, search — radius-sm |
| large action | 36px | 14px | 15/20, 600 | `.btn` radius-md; focused flow, not shell chrome |
| desktop icon action | 28/30/36px | 10px | 16px Lucide | accessible name required |
| Badge/count | 20px | pill | 12/16, 500 | neutral descriptive data |
| Status | 22px | pill | 12/16, 500 | dot + visible label |
| technical Tag | 18px | 6px | 11/14 mono | separate semantic anatomy |
| multiline field/composer | minimum 44px | 14px | 14–15/21 | content may grow |
| desktop menu row | 40px | 10px inner | 14/20 | grouped items only |
| mobile action row | 48px | 10px inner | 15/20 | full-width Sheet action |
| bounded work object | content-driven | 14px | role-specific | Run, permission, review |
| large panel | content-driven | 18px | role-specific | sparse use |
| mobile Sheet | up to 92dvh | 28px top | role-specific | safe-area footer |

Coarse-pointer targets are at least 44×44px. A smaller visible control may extend its hit area only when it cannot overlap a neighboring target.

Semantic `data-slot` values belong to the component that owns behavior. Product assemblies add `data-part` or a named composite hook; they never overwrite a Button, Item, trigger, or field slot because coarse-pointer, focus, and consistency rules bind to that semantic owner.

## 3. Concentric radii

Nested rounded surfaces follow `outer radius = inner radius + padding` while layers remain visually adjacent. If padding exceeds 24px, treat the layers as independent surfaces. The consistency review must flag identical parent and child radii when they share a visible corner.

Persistent rail, topbar, facet strip, table/list region, and workspace panes are not rounded cards. Radius belongs to controls, bounded work objects, and overlays.

## 4. Surface and depth rules

- Hairlines separate persistent regions and ruled rows.
- Form controls keep a real border for accessible focus and invalid states.
- Floating menus, popovers, dialogs, sheets, and bounded elevated objects use semantic layered shadows.
- The coral primary action may use the restrained coral glow; neutral buttons do not lift.
- Selected navigation uses warm neutral fill, never coral.
- Neutral secondary/tertiary actions are borderless soft-fill (`secondary`) or `ghost`; the bordered `outline` variant is the reserved 1.5px coral anatomy, never reached for a neutral control.
- Destructive/danger reads warm attention-gold (soft fill + gold ink), not a loud red — the grammar has no `--color-danger`, and coral is never spent on delete.
- Nested card stacks and ornamental glass effects are prohibited.
- Images and photos use an inset `1px` pure-black 10% outline in light mode and pure-white 10% outline in dark mode.

## 5. Typography and copy

- Geist Variable is the human-readable UI font; JetBrains Mono Variable is reserved for technical metadata.
- Production weights are only 400, 500, 600, and 700.
- Headings use balanced wrapping. Short-to-medium descriptions and captions use pretty wrapping. Long prose keeps normal wrapping.
- Dynamically changing counts, timers, progress, replay cursors, and numeric columns use tabular numerals.
- Root rendering uses antialiasing on macOS.
- Long Slovak copy must remain readable; truncation is allowed only when the full identity is recoverable through the same interaction.

## 6. Iconography

Lucide is the only product icon vocabulary until an explicit ADR changes it.

| Role | Size |
| --- | --- |
| inline/badge glyph | 12px |
| banner / rail-cmd / approval-head glyph | 14px |
| control / button / search glyph | 15px |
| default control/navigation glyph | 16px |
| rail identity glyph | 15–17px |
| desktop menu glyph | 18px |
| empty-state medallion glyph | 20px |
| mobile navigation glyph | 24px |

This scale is expressed as tokens (`--icon-inline` `--icon-banner` `--icon-control` `--icon-base` `--icon-menu` `--icon-empty` `--icon-mobile-nav`); containers reference a token rather than hand-rolling `svg { width/height }`. A zero-specificity `@layer base` safety net snaps any unsized Lucide glyph to the 16px base, so a bare icon never falls to the raw 24px default.

Icons inside shadcn components inherit sizing from the owning component and use `data-icon` for inline start/end placement. Static navigation icons do not animate. Contextual state-swap icons may cross-fade with opacity, scale `0.25 → 1`, and blur `4px → 0` using the productive easing; no motion dependency is added only for this effect.

## 7. Interaction and motion

- Interactive state changes use interruptible CSS transitions.
- Never use `transition: all`; list exact properties.
- Default durations remain 120/180/260ms with the productive non-bouncy easing.
- Press feedback may use `scale(0.96)` only when it does not disturb dense row layout; reduced motion disables it.
- One-shot entrance motion is split into semantic chunks and kept subordinate to task completion.
- Exit motion is shorter and subtler than entrance motion.
- `will-change` is added only after measured first-frame stutter and only for transform, opacity, filter, or clip-path.
- Existing default-state UI does not animate on initial page load.

## 8. Focus and keyboard

- Focus is always visible with the semantic ring and strong boundary.
- Escape closes safe overlays and restores trigger focus.
- Menus, Selects, Commands, and chat items remain inside their official Group/Scroller anatomy.
- Dialog, Sheet, and Drawer always expose a title.
- Icon-only controls always have an accessible name.
- Pending actions preserve their verb, compose Spinner, and become disabled.

## 9. Storybook library structure

```text
Foundations
Actions
Forms
Navigation
Identity & status
Feedback
Overlays
Product composites
Collaboration
Agent work
Templates
Reference screens
Consistency
```

Every public component gets an Autodocs entry and the applicable subset of:

- Playground;
- anatomy;
- approved variants;
- approved sizes;
- default/focus/disabled/invalid/selected/pending states;
- long Slovak copy;
- keyboard behavior;
- coarse pointer;
- reduced motion;
- light/dark translation.

Inputs do not gain arbitrary size variants and Badges do not gain free-form colors only to fill a matrix. Storybook documents the approved product API, not every upstream escape hatch.

## 10. Consistency gate

After per-component and template stories are in place, `Consistency/Control matrix` renders Button, Input, search, Select trigger, compact action, Badge, Status, menu row, and mobile row together. Browser assertions measure:

- exact height and minimum hit area;
- computed radius;
- computed font size, line height, and weight;
- border width/color;
- surface and foreground roles;
- icon box and optical placement;
- focus ring without layout shift;
- disabled opacity and retained geometry;
- 390, 767/768, 1023/1024, and 1440 behavior.

The same gate audits nested radii, dynamic numeric alignment, transition-property specificity, console errors, failed network requests, axe results, and long-copy overflow. A component or template is not ratified from source inspection alone.

`Consistency/Geometry gate` (`geometry-gate.stories.tsx`) makes the nested-radius and icon-box audits executable: a generic walker asserts `outer = inner + padding` (±1px, pills/circles excluded) for every rounded child flush inside a rounded, non-clipping parent, and an icon-box audit asserts every Lucide glyph is on the §6 scale with none at the raw 24px. It runs the empty-state medallion, run card, and permission gate at desktop, dark, and coarse-pointer under `test:storybook`.
