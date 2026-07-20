# Autopilot Canonical Visual Glossary

- Status: production normalization of the legacy operator wireframe board
- Visual authority: `autopilot-operator-web-product-wireframes`
- Board URL: `http://127.0.0.1:4317/wireframes/questpie-autopilot/main/project/autopilot-operator-web-product-wireframes/index.html`
- Board source: `/Users/drepkovsky/.agent-board/projects/questpie-autopilot/wireframes/autopilot-operator-web-product-wireframes`
- Implementation contract: [`DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md)
- Primitive mapping: [`primitive-mapping.md`](./primitive-mapping.md)

## 1. How to read the source board

The board contains strong repeated full-screen compositions and weaker historical component cards. The production system uses this precedence:

1. shared `tokens.css`;
2. split `base.css`, `shells.css`, `work.css`, `collab.css`, `goal.css`, `adaptive.css`, `primitives.css`, and `states.css`;
3. the six large `shell-nav`, `adaptive`, `work`, `collab`, `goal`, and `states` component galleries;
4. repetition across the 89 full-screen compositions;
5. behavior/data glossaries and the consistency audit;
6. standalone historical component cards and one-off inline screen styling.

When sources disagree, the more repeated full-screen contract wins. The resolution is recorded here instead of preserving visual drift.

The old small `Button.html`, `Field.html`, and similar cards are not implementation authority: they reference the missing historical `kit.css` and obsolete variables. `kit.css.bak` and the dark/purple direction in the old design brief are archival evidence only.

## 2. Visual language

Autopilot is a dense operational workspace on warm paper. Persistent regions are flat and separated by warm hairlines. White is reserved for working surfaces and floating layers. Selection uses a warm neutral fill. Coral is used for the single advancing action and for clearly distinguishable Agent provenance; it does not color every selected or active object.

The interface should feel inhabited and precise, not sterile. Compact typography, small metadata, ruled rows, calm empty space, and visible actors carry more weight than oversized headings or dashboard cards.

## 3. Foundation glossary

### 3.1 Surface and color roles

| Canonical role | Light value | Dark translation | Meaning |
| --- | --- | --- | --- |
| `canvas` | `#FBF9F5` | `#141210` | warm paper application background |
| `background` | `#FBF9F5` | `#141210` | content pane background |
| `surface` | `#FFFFFF` | `#201C18` | working surface, overlay, bounded object |
| `surface-sunk` | `#F2EEE7` | `#2A251F` | neutral control, muted band, soft hover |
| `surface-selected` | `#ECE6DC` | `#342E26` | active navigation and selected object |
| `surface-rail` | `#F7F3EC` | `#1A1714` | Company rail and mobile navigation drawer |
| `ink` | `#1C1A17` | `#F4EFE7` | primary text and active neutral icon |
| `ink-muted` | `#5C544A` | `#B6AC9C` | functional secondary text |
| `ink-subtle` | `#938A7D` | at least `#8E8577` | tertiary metadata; dark value is raised for AA at small sizes |
| `ink-disabled` | `#C3BAAD` | `#5F574C` | disabled decoration and inactive structure |
| `hairline-subtle` | `#EEE8DD` | `#2A251F` | low-emphasis internal separation |
| `hairline` | `#E4DCCE` | `#35302A` | default region/control border |
| `border-strong` | `#D3C8B7` | `#48413A` | focused or emphasized boundary |
| `coral` | `#F26A45` | `#F77F54` | one advancing CTA; live/running dot |
| `coral-tint` | `#FDEDE6` | coral at 16–18% | Agent/Autopilot provenance background |
| `coral-ink` | `#D9542F` | `#F99A73` | Agent mark, Agent mention, generated provenance |
| `success` | `#2E9E5B` | `#4ECB7B` | completed/healthy dot with text |
| `attention` | `#E0A33C` | `#E8B45A` | waiting, permission, caution, recoverable failure |
| `idle` | `#C3BAAD` | `#6E6559` | queued, dormant, not started |

Rules:

- Active navigation is `surface-selected + ink`, never coral.
- An Agent mark is `coral-tint + coral-ink`; it must not look like a CTA.
- Status color is always accompanied by a visible label.
- Destructive or permission-sensitive work uses attention or danger semantics with plain-language copy, never a large red wash.
- Light mode is canonical. Dark mode keeps the same geometry and hierarchy.

### 3.2 Typography roles

Human-readable UI uses **Geist Variable**. Technical metadata uses **JetBrains Mono Variable**. Mono is an information role, not a terminal aesthetic.

| Role | Size / line | Weight | Examples |
| --- | --- | --- | --- |
| `micro` | 11/14 | 500–600 | timestamp, unread count, replay cursor, keyboard shortcut |
| `eyebrow` | 11/14 | 600, uppercase, `0.08em` | `PRIESTORY`, `KANÁLY`, state group heading |
| `caption` | 12/16 | 500–600 | status chip, tag, compact supporting label |
| `meta` | 13/18 | 400–500 | row metadata, helper copy, Actor role |
| `body` | 14/21 (`1.5`) | 400 | prose, form content, message copy |
| `compact-title` | 15/20 | 500–600 | row identity, navigation item, button label |
| `topbar-title` | 18/18 | 600, `-0.01em` | Space or surface identity in shell topbar |
| `screen-heading` | 24/29 | 600, `-0.01em` | true page heading outside compact shell chrome |
| `display` | 28/31 | 700, `-0.02em` | onboarding, focused empty launchpad only |

Rules:

- Exactly one semantic `h1` exists per screen, but a topbar `h1` remains visually 18px.
- Operational pages do not begin with a 32px dashboard heading.
- Row titles and rail items generally use 15px; metadata stays 11–13px.
- Numeric metadata uses tabular figures.
- Long Slovak labels truncate only where identity is recoverable elsewhere; instructions and decisions wrap.

### 3.3 Spacing, shape, and density

| Role | Canonical value |
| --- | --- |
| Base spacing | 4px |
| Common gaps | 8px and 12px |
| Dense desktop region padding | 12–20px depending on ownership |
| Desktop control | 32px |
| Compact control | 27–28px |
| Icon button | 30–32px desktop; at least 44px coarse pointer |
| Navigation row | 30px Space/Channel; 32px top-level item |
| Work row | minimum 40px |
| Settings row | minimum 52px |
| Desktop menu row | 40px |
| Mobile menu/action row | 48px |
| Rail | 236px |
| Normalized shell topbar | 61px |
| Contextual Thread | 380px anchored; fluid as a full pane |
| Default control radius | 10px |
| Bounded object radius | 14px |
| Large panel radius | 18px |
| Desktop floating radius | 12–14px |
| Mobile Sheet top radius | 28px |

The radius scale is soft but controlled: 10 / 14 / 18 / 24 / pill. Persistent shell regions are not rounded cards. Rows are ruled with hairlines. Floating layers alone receive `shadow-pop`; the primary coral Button may receive the restrained coral glow.

Production typography uses only the variable-font weights 400, 500, 600, and 700. Historical intermediate values such as 650 are normalized to 600 so rendering remains deterministic across platforms.

### 3.4 Icons and identity marks

- Default glyph: 16px.
- Rail item glyph: 15–17px.
- Desktop menu glyph: 18px.
- Mobile tab glyph: 24px.
- Human avatar: circular, initials/photo, 22/28/40px sizes.
- Agent avatar: the same 22/28/40px footprint as a Human, with a quiet coral tint/ink and a restrained 30% soft-square radius.
- Presence: 9px round coral dot with a 2px ring matching its host surface.
- Running state dot: 6–8px coral dot with a quiet outer halo.

Human and Agent Actors have identical footprint, layout, availability, interaction, and permission treatment. The quiet tint, soft-square mark, and authored provenance communicate Agent identity without a robot icon or a separate feature category. This is the canonical owner correction: parity means equal product treatment, not visually erasing whether the Actor is Human or Agent.

## 4. Primitive element glossary

### 4.1 Button

**Anatomy:** label; optional 15px leading/trailing icon; optional Spinner; one focus outline. Desktop default is 32px high, compact is 27px, icon-only is 30–32px. Coarse-pointer targets grow to at least 44px.

**Visual variants:**

- `primary`: accessible deep-coral solid fill, white ink, restrained coral glow, and a subtle top-edge highlight; only one advancing action per screen state. Brand coral remains `#F26A45`; the solid CTA uses `#C94C2C` because white on the brighter source-board coral reaches only 3.03:1, while white is the required visual foreground.
- `secondary`: sunk warm neutral fill, ink label, no border or lift.
- `outline`: transparent/surface fill with warm hairline; used for contextual triggers and bounded neutral actions.
- `ghost`: transparent, muted ink; hover becomes sunk neutral.
- `destructive`: quiet caution/danger treatment with explicit verb; never a large solid red default.

**States:** hover changes fill only; active uses an interruptible `scale(0.96)` press response; focus uses a visible 3px semantic ring; disabled retains geometry at about 45–50% opacity; pending composes Spinner + disabled and keeps the action label.

**Resolution:** the old standalone Button card described pills and an ambiguous `accent`; repeated screens use compact 10–14px radii and explicit primary/neutral/ghost roles. The screen grammar wins.

### 4.2 Badge, Status, Pill, Tag, and Keyboard hint

- `Badge/Pill`: 20px high, 12px label, warm sunk fill, subtle border, 10px radius.
- `Status`: 22px high; 7px dot + visible label; optional elapsed/meta in mono. Running, attention, waiting, done, idle, and failed are semantic states, not arbitrary colors.
- `Tag`: 18px high, 11px mono, 6px radius; error class, scope, type, provenance id.
- `Keyboard hint`: 11px mono on sunk warm fill, 6px radius.
- `Generated provenance`: coral tint + coral ink, 11px label; names the Agent or generation source.

Counts, tags, Actor identity, and lifecycle state are different semantics and must not share one free-form color prop.

### 4.3 Field, Input, Search, Select trigger, and Textarea

**Field anatomy:** label; optional description; control; optional inline validation. Forms use predictable vertical grouping and retain the 4px spacing rhythm.

**Single-line control:** 32px desktop height, 12px horizontal padding, 10px radius, white surface, warm 1px border, 15px input text. Search adds a 15px subtle leading icon. Focus strengthens the border and adds a quiet 3px ring without changing layout.

**Textarea/composer input:** 12px padding, 14–15px copy, 14px radius, minimum 44px. Composer becomes a composite because it also owns mentions, attachments, context, send, optimistic state, and AI trigger semantics.

**States:** empty, filled, focus, disabled, invalid, async validation/pending, long value, write-only secret. Invalid keeps typed content; secret values never echo after storage.

**Adaptive rule:** inputs remain at least 16px on coarse pointers to avoid mobile zoom. A trigger keeps its Field shape but opens an anchored popup at desktop and a Sheet below 768px.

### 4.4 Surface, Card, Panel, and Document

- `canvas`: warm paper behind the workspace.
- `rail`: warm off-paper persistent navigation surface.
- `flat workspace`: white or paper region with hairline boundaries; default page grammar.
- `bounded object`: white surface, subtle hairline, 14px radius; Run, permission, review, directory tile.
- `panel`: 18px radius for a larger bounded group, not for every section.
- `document`: readable body up to roughly 720px, optionally paired with the 380px Thread.
- `overlay`: white surface, hairline, 12–14px radius, real floating shadow.

Nested raised-card stacks are prohibited. Structure should be visible through regions, bands, and ruled rows before Card is introduced.

### 4.5 Menu, Dropdown, Select, Combobox, and Command Palette

**Desktop panel:** about 320px wide, maximum 60vh/416px, 4px internal padding, white surface, subtle hairline, 12px radius, floating shadow. Combobox/Command adds a pinned search header.

**Row:** 40px, 12px horizontal padding, 12px gap, 18px icon, truncated label, optional mono meta, 17px selected check. Hover and roving selection use sunk neutral. Destructive rows use a quiet caution tint. Separator is a 1px hairline with 4px vertical margin.

**Mobile:** same logical options become a bottom Sheet with 48px full-width rows. Selection is announced; the selected or first enabled item receives focus. A mobile Sheet does not pretend to be a desktop listbox when its interaction model is ordinary buttons.

**Command Palette:** grouped Command items inside a titled Dialog at desktop and an adaptive Sheet on mobile. It searches destinations and actions; it does not silently execute destructive work.

### 4.6 Popover and Tooltip

- Popover: about 300px, 16px padding, 14px radius, muted 14px copy, `role=dialog` when interactive.
- Tooltip: short, non-interactive explanation only; never owns essential information.
- Below 768px, essential tooltip/popover disclosure becomes a titled Sheet.
- Escape/outside click closes safe disclosures and restores trigger focus.

### 4.7 Dialog, Confirm, Sheet, and Drawer

**Desktop Dialog:** centered on a warm-ink scrim; maximum 400px, 20px padding, 12px radius, one scrolling body when needed.

**Mobile Sheet:** bottom anchored; width up to 448px; height up to 92dvh; 28px top radius; 40×6px grabber; centered 15–16px title; one scrolling body with 20px horizontal padding; pinned footer with a hairline and nonzero safe-area floor.

**Navigation Drawer:** 300px / maximum 86vw, full dynamic viewport height, uses the rail surface and the same navigation configuration.

**Confirm:** explicit consequence, cancel and confirm actions, focus trap, safe dismissal rules. Destructive confirmation cannot be dismissed while an irreversible request is pending.

### 4.8 Tabs, Facets, Toggle, and Preset

- Tabs/Facets use a neutral ink underline, never coral.
- Standard item uses 15px medium text, 12px vertical padding, 2px underline.
- Space facet order is canonical: `Prehľad | Úlohy | Ciele | Kanál | Znalosti | Dashboardy`.
- Counts do not reorder facets. Narrow overflow scrolls or moves secondary entries behind More.
- View preset is a 28px pill; selected uses warm `surface-selected`.
- Two-to-five local options use a real ToggleGroup; selection remains neutral.

### 4.9 StateBand and ObjectRow

**StateBand:** a full-width compact boundary for offline/replay, grouped state, or attention. It uses a 6px dot, 12px label, optional right-aligned 11px mono metadata, a warm tint, and a bottom hairline. It never becomes a dismissible Toast for durable state.

**ObjectRow:** declared minimum 40px with 12px vertical and 20px horizontal padding; natural canonical rows render around 46–47px before bounded-list flex shrinking. The immutable reading order is selection checkbox → 7px lifecycle dot → 18px mono TechnicalTag → 15px title → 13px typed projections. Progress is 140×6px; Actor marks are 22px. Default is ruled, not carded. Hover uses white/sunk paper; selected uses warm `surface-selected`. The title activation seam remains separate from Checkbox, watch, undo, and other row actions.

**SelectionBar:** 44px, 20px horizontal padding, ink 16px Checkbox, 13px selection count, neutral 27px actions, optional scope copy, and a right-aligned clear action. Selection coral is prohibited.

**StateGroup header:** 46px sticky header with a 22px Status, 18px mono count, and optional right-aligned live/filter context. `StateGroup` owns typed rows and optional quick-add data; it does not expose an arbitrary child assembly seam.

**QuickAddRow and VirtualizationTail:** quick-add follows the same ruled row rhythm and remains neutral; the tail is a centered, non-sticky 42px statement of the unrendered count. Neither pretends that every collection row is mounted.

### 4.10 Actor and Presence

**Actor:** circular avatar, 13px name, optional 12px role/availability, optional presence. `ActorIdentity` is borderless; `ActorStack` overlaps avatars by 6px; `ActorToken` is reserved for a selected/removable value. Human and Agent geometry is identical. Agent difference is the quiet Agent tint and explicit provenance copy, not a robot icon, purple chip, or bot-only container.

**Presence row:** overlapping Actors with a host-surface ring; cap to a small visible set and show `+N`. Presence is ephemeral realtime state; absence means unknown/offline, not an error.

### 4.11 Thread, Message, Mention, and Composer

**Thread:** header (52px) → compact tabs → MessageScroller → Composer. It is 380px when anchored and a full pane for Channel/DM. The same primitive hosts task, goal, channel, and direct conversation context.

**Message:** Slack-like authored row, not a chatbot card wall. Avatar; name; 11px mono time; 15px wrapping message; optional structured Agent work. Human and Agent use the same anatomy. System events use a slim Marker.

**Mention:** atomic Actor reference. Agent mention uses coral provenance tint; human mention uses warm neutral tint. `@Autopilot` is a real work trigger and must remain distinguishable from plain text.

**Composer:** warm rail surface, hairline, 14px radius; input at least 40px; bottom action row. Send is ordinarily neutral. Pending, attachment, mention-open, offline, read-only, and permission states are explicit.

### 4.12 Agent work, Run, Permission, and Recap

The canonical sequence is:

```text
Actor Message
└─ Plan / semantic activity groups
   └─ Live status and honest elapsed time
      └─ Permission gate when authority is insufficient
         └─ Recap, effect result, and provenance
```

**Run summary:** fixed vertical footprint. Shows lifecycle, elapsed time, latest semantic activity group, and at most one current action. Consecutive low-level tools compact to “Used N tools · latest: …”. Opening the summary reveals full Run detail.

**Plan/activity card:** white or rail surface, subtle border, 14px radius; compact head and 32–40px step rows. One active step has a coral running dot; completed steps have green dots; future steps stay idle.

**Live tail:** one bounded line of current semantic output, not an unbounded token log. Steering controls collapse behind a menu on narrow screens.

**Permission gate:** gold attention hairline/tint, plain-language requested effect, reason, scope, and Allow/Deny actions. Permission is durable state, not a modal-only interruption.

**Recap/provenance:** identifies the Agent, output, evidence, and effects. Completed work may become a normal Message/ObjectRow while retaining provenance.

### 4.13 Review, Settings, Empty, Loading, Error, and Access

- `Review`: bounded reading-first object with labeled sections, deliverable, confidence, attention, and one approval action.
- `Settings group`: eyebrow + one bordered panel of 52px ruled rows; controls align right.
- `Empty`: launchpad with icon, title, hint, and one next action; not a dead card.
- `No results`: explicitly names active filters/search and offers reset.
- `Loading`: Skeleton geometry matches final rows/cards and exposes `aria-busy`.
- `Error`: replaceable runtime/load failure with retry.
- `Access`: authorization/not-found state, distinct from runtime failure.
- `Inline error`: stays next to the failed transaction and preserves input.
- `Offline/replay`: StateBand with replay cursor/count; reconnect is not presented as success.

## 5. Shell glossary

### CompanyShell

Desktop grid is `236px + minmax(0, 1fr)` with an optional 380–400px contextual Thread. The rail contains:

1. Company mark and name;
2. 34px command/search row with shortcut;
3. scrolling attention band;
4. Spaces;
5. Channels;
6. direct Actors;
7. Library, Automations, Team, Settings;
8. optional Agent-authored structure proposal;
9. current Actor pinned at the bottom.

Only the navigation body scrolls. Brand/command and Actor/footer remain pinned. Active navigation uses warm neutral selection.

### SpaceContext

Normalized 61px topbar. Fixed anatomy is `icon → identity → context → actions`:

- identity: one Space title or breadcrumb;
- context: Project scope, type/status, member metadata;
- actions: presence, invite, one screen action, overflow.

The primary Space facet bar sits directly below it and is present on every Space-owned screen.

### Mobile shell

Below 1024px the rail becomes a navigation Drawer. A 52px+ compact mobile header owns menu/title/command. Primary destinations mirror into the bottom navigation from the same navigation configuration. Safe-area padding is nonzero even when the environment reports zero.

## 6. Motion, realtime, and honest timing

- Hover/focus: 100–150ms.
- Productive transitions: 120/180/260ms.
- Reduced motion: no transform; 1ms fades/transitions.
- Live content enters only after a real submitted/running/replay state.
- Reconnect shows replay progress; it does not fake continuity.
- AI planning, tools, permission waits, and recaps have realistic elapsed time.
- Optimistic Messages/rows remain visibly pending until persisted ids reconcile.

## 7. Canonical inconsistency resolutions

| Board inconsistency | Production decision |
| --- | --- |
| standalone Button says pill/primary/accent; screens use compact soft/solid controls | repeated screen Button grammar wins; closed variants are primary, secondary, outline, ghost, destructive |
| shell CSS says 56px topbar but populated screens measure about 60–61px | normalize `SpaceContext` to 61px |
| Jubli reference says 256px rail; operator shell repeatedly uses 236px | Autopilot rail is 236px |
| old prose describes dark-first | current warm light board is canonical; dark is a translation |
| some Agent surfaces are card/bubble-like, others Slack-like | Message stays Slack-like; bounded Run/permission objects may have their own surface |
| facet bars drift or disappear | one ordered facet config appears on every Space screen |
| topbar scopes/actions differ per screen | one slot order: icon → identity → context → actions |
| status, access, error, and empty are mixed | keep five explicit semantic families plus offline/replay |
| mobile overlay mechanics vary | one adaptive controller per primitive; 768 overlay and 1024 shell breakpoints remain independent |

## 8. Review checklist

Before a mapped primitive is accepted in Storybook, verify:

- computed size, font, radius, surface, border, and state against this glossary;
- 390, 767/768, 1023/1024, and wide layouts;
- light and warm dark themes;
- long Slovak labels, truncation, and wrapping;
- keyboard, Escape, focus restoration, and screen-reader naming;
- coarse-pointer 44/48px targets and 16px inputs;
- safe-area and virtual keyboard behavior;
- loading, empty, error, access, permission, offline/replay, and reduced motion;
- no inline style, raw feature color, or competing primitive API.
