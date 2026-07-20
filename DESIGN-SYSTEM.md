# QUESTPIE Autopilot v2 Design System

- Status: canonical contract; Storybook ratification is required before product pages
- Language: English in docs, APIs, stories, and tests; Slovak in product fixtures
- Stack: React 19, shadcn/ui `base-nova`, Base UI, Tailwind CSS v4, Vite, Storybook
- Visual authority: the complete `autopilot-operator-web-product-wireframes` board
- Interaction reference: Jubli informs mobile-native mechanics and finish, not a second visual language

Detailed references:

- [`docs/visual-glossary.md`](docs/visual-glossary.md) — normalized element anatomy and measured visual roles
- [`docs/primitive-mapping.md`](docs/primitive-mapping.md) — wireframe element to shadcn/Base UI and `@questpie/ui` layer mapping
- [`docs/interface-quality-rules.md`](docs/interface-quality-rules.md) — shared geometry, concentric radius, motion, icon, template-first, and consistency gates

## 1. Source of truth

The entire legacy operator board is the canonical visual source, including its Company sidebar, shell, navigation, top bars, facet strips, object rows, contextual Thread, command surface, Agent messages, live Runs, permission gates, and responsive intent:

- Board: `http://127.0.0.1:4317/wireframes/questpie-autopilot/main/project/autopilot-operator-web-product-wireframes/index.html`
- Source: `/Users/drepkovsky/.agent-board/projects/questpie-autopilot/wireframes/autopilot-operator-web-product-wireframes`

We do not reproduce one-off HTML or stale domain assumptions. Repeated patterns become one semantic component; repeated measurements become tokens; contradictions are resolved in favor of the most repeated full-screen composition and documented on Agent Board. Jubli contributes touch ergonomics, overlay transitions, optical rhythm, and native-feeling mobile disclosure.

## 2. Visual character

Autopilot is a warm, paper-like operational workspace. Persistent chrome is flat and separated by hairlines. Dense rows carry the information hierarchy. Floating elevation belongs to overlays, contextual Thread, and the one active decision. Coral identifies both the advancing action and Autopilot provenance because that is the board's repeated grammar. Human and Agent actors keep identical geometry and differ through provenance, permissions, presence, and copy.

The shared hue family never means shared component semantics. A light-mode advancing CTA uses the accessible solid `--action-solid` with white `--action-ink`, an inset top highlight, and the restrained action glow. Agent identity uses only `--agent-tint` plus `--agent-ink-aa` in marks, mentions, and provenance; it never inherits solid-button fill, foreground, or glow. These roles are separate tokens and are not interchangeable even though both descend from the canonical coral family.

This contract explicitly supersedes the rejected Inter, blue-action, violet-Agent, roomy KPI-card direction. Cards are bounded work objects, not the default page layout.

## 3. Foundations

### 3.1 Color roles

Light mode preserves the measured board palette. Dark mode is a coherent luminance translation and never replaces the light-first identity.

| Role | Canonical light value | Use |
| --- | --- | --- |
| Paper canvas | `#FBF9F5` | application background |
| Rail paper | `#F7F3EC` | Company sidebar and quiet chrome |
| Sunk paper | `#F2EEE7` | selected nav, grouped controls, subdued bands |
| Surface | `#FFFFFF` | object workspace and floating content |
| Ink | `#1C1A17` | primary copy |
| Muted ink | `#5C544A` | secondary functional copy |
| Faint ink | `#938A7D` | timestamps and tertiary metadata |
| Hairline | `#E4DCCE` | persistent region and row separation |
| Coral | `#F26A45` | advancing action, Autopilot, live attention |
| Coral tint / ink | `#FDEDE6` / `#D9542F` | Agent provenance and quiet selected states |

Statuses always include text. Green means completed/healthy, gold means waiting/attention, and red means failure/destructive. Status colors are never an unlabeled traffic-light decoration.

### 3.2 Typography

The UI uses bundled **Geist Variable**. Technical metadata, event ids, replay cursors, durations, and tabular counters use bundled **JetBrains Mono Variable**. No remote font request is allowed.

The hierarchy is deliberately small and dense, like the board and Jubli:

| Role | Size / line | Weight | Use |
| --- | --- | --- | --- |
| Micro | `11/14` | 500 | time, ids, counters, technical meta |
| Caption | `12/16` | 500–650 | labels, statuses, rail sections |
| UI body | `13/18` | 400–550 | rows, navigation, controls |
| Emphasized body | `14/20` | 550–650 | object identity, overlay title |
| Structural title | `18/24` | 650 | page/object title |
| Product title | `20–24/30` | 650 | onboarding and rare empty-state moments |

Uppercase section labels use `11/14`, semibold, and restrained tracking. Large dashboard typography is not part of the operational shell. Numeric metadata uses tabular figures. Long Slovak copy must wrap without increasing fixed Run summaries or breaking action alignment.

### 3.3 Geometry

| Role | Canonical measurement |
| --- | --- |
| Base spacing | 4px scale; frequent gaps 8px and 12px |
| Desktop controls | 32px default, 28px compact |
| Touch target | at least 44px; mobile selection rows 48px |
| Company rail | 236px |
| Top/context bar | 61px |
| Object rows | typically 40–48px, ruled by hairlines |
| Contextual Thread | about 380px when pinned |
| Bounded card radius | 14px maximum |
| Desktop overlay | about 320px wide, 12px radius |
| Mobile Sheet | max 448px, 92dvh, 28px top radius, 40×6 grabber |

Corners stay compact in persistent chrome. Shadow belongs to floating content; primary coral actions may receive a restrained glow. The shell and lists never become a field of elevated cards.

### 3.4 Motion and focus

Productive motion uses 120/180/260ms and a non-bouncy easing. Focus uses a visible coral ring plus border contrast. Reduced motion removes transforms and shortens animation to 1ms. Optimistic and AI states keep honest timing; no content materializes instantly as if work had already completed.

## 4. Information architecture

The repeated desktop grammar is:

```text
CompanyShell
├─ Company rail
│  ├─ Company identity + command/search
│  ├─ Home / Inbox / Activity
│  ├─ Spaces
│  ├─ Channels
│  ├─ direct Actors
│  └─ Library / Automations / Team / Settings + current Actor
└─ Workspace
   ├─ SpaceContext top bar
   ├─ reconnect/replay StateBand when needed
   ├─ FacetNav
   └─ ObjectList or ObjectDetail
      └─ contextual Thread / evidence panel when relevant
```

Company root supplies Home, Needs you, Activity, Company switching, and company-wide attention. Whole Company is the first system-managed Space and owns the company-wide `#general`; every operational Space owns its own distinct `#general` and may own additional Channels. The rail Channel group always reflects the active Space. Projects are optional grouping inside one Space and never replace its membership or authorization boundary. One navigation configuration drives desktop rail, mobile drawer, and bottom navigation.

## 5. Component system

The dependency direction is strict:

1. `components/ui`: CLI-owned shadcn/Base UI source, one component per file.
2. `components/composites`: domain-free product grammar (`ActorMark`, `ActorIdentity`, `ActorStack`, selected `ActorToken`, `Status`, `StateBand`, `ObjectRow`, adaptive overlays).
3. `components/ai`: presentational Agent Message → Run plan/live state → Permission gate → Recap/provenance.
4. `components/templates`: query-free `CompanyShell`, `SpaceContext`, `FacetNav`, Object list/detail, Channel, and contextual Thread assemblies.
5. apps: TanStack Query, QUESTPIE Channels, commands, permissions, and routes.

Apps import only the public `@questpie/ui` surface. Product components contain no queries. Durable Channel, Message, Thread, Run, steering, and effect truth remains in QUESTPIE collections; UI adapters only project it.

### 5.1 Primitive discipline

- Use shadcn variants and semantic tokens; layout `className` does not recolor or retype primitives.
- Forms use `FieldGroup` + `Field`; validation uses `data-invalid` and `aria-invalid`.
- Base UI custom triggers use `render`, not remembered Radix `asChild` APIs.
- Menu/Select/Command items stay inside their Group.
- Dialog, Sheet, and Drawer always have a title.
- Pending buttons compose `Spinner` + `disabled`.
- Message history may reuse qualified `MessageScroller` behavior, but product messages are unboxed authored rows with Markdown and typed work blocks. `Bubble` is not part of the Autopilot chat anatomy.
- No inline styles, raw feature colors, page-owned portal positioning, or parallel home-grown primitive set.

### 5.2 Repeated product grammar

- `StateBand`: reconnect, replay, grouped state, or attention boundary.
- `ObjectRow`: compact leading state, identity, progress/meta, Actor/Run state, and contextual actions.
- `ActorMark` / `ActorIdentity` / `ActorStack`: circular Human/Agent parity, borderless identity, and compact presence. Pill tokens are reserved for selected/removable values.
- `RunSummary`: fixed vertical footprint; lifecycle, elapsed time, latest semantic activity group, and at most one action.
- `RunDetail`: expanded grouped events, permissions, effects, evidence, attempts, and steering.
- `CompanyShell`: full navigation and adaptive shell.
- `SpaceContext`: object identity and members/actors before facets.
- `FacetNav`: one ordered configuration; counts and overflow do not reorder core facets.

Consecutive low-level tools compact to semantic copy such as “Used 4 tools · latest: searched Knowledge.” Full tool history appears only after opening Run detail.

## 6. Adaptive behavior

- At `<768px`, menus, selects, popovers, tooltips with disclosure, modal flows, and confirmations become the canonical bottom Sheet. Desktop uses anchored/centered Base UI surfaces.
- At `<1024px`, the persistent rail becomes a compact header, navigation Drawer, and bottom navigation.
- The Work control bar has three authored modes: compact disclosure below `768px`, an explicit two-row medium mode from `768px` through `1439px`, and the single-row canonical wide composition at `1440px` and above. The medium mode is intentional shell geometry, not flex-wrap fallback.
- Inputs use at least 16px on coarse pointers; actions remain at least 44px.
- Sheets have a pinned safe-area footer, one scrolling body, focus restoration, and virtual-keyboard-safe layout.
- Contextual Thread pins only when space permits; otherwise it opens through Drawer/Sheet.

Regression widths are 390, 767/768, 1023/1024, and wide desktop. Every locked component is checked in light/dark, long Slovak copy, keyboard, reduced motion, and realistic loading/reconnect/error states.

## 7. Storybook ratification

Storybook is the design review surface. Before pages may consume a component, the reference set must cover:

1. measured color, typography, density, icon, focus, status, and motion foundations;
2. CLI primitives and adaptive overlay anatomy;
3. StateBand, ObjectRow, Actor parity, and the full Agent state family;
4. Company shell desktop/mobile, Channel, live Task Run, and command palette;
5. exact 390, 767/768, 1023/1024, and wide measurements;
6. axe, keyboard order, Escape, focus restoration, scroll lock, safe areas, and reduced motion;
7. visual comparison to the canonical board with evidence stored on Agent Board.

The required gates are `bun run format:check`, `bun run lint`, `bun run check-types`, `bun run test`, `bun run storybook:test`, and `bun run storybook:build`. Product page work begins only after an independent accept/revise ratification.

Templates are allowed before data integration as grounded, query-free prototypes. They are reviewed with typed dummy projections first; QUESTPIE collections, TanStack Query factories, and Channel reconciliation are connected only after their information architecture and responsive behavior are ratified.
