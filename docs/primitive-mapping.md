# Canonical Wireframe to `@questpie/ui` Mapping

- Visual definitions: [`visual-glossary.md`](./visual-glossary.md)
- System contract: [`DESIGN-SYSTEM.md`](../DESIGN-SYSTEM.md)
- UI stack: shadcn/ui `base-nova`, Base UI, Tailwind CSS v4, Storybook

## 1. Mapping rules

1. Preserve interaction and accessibility behavior from CLI-owned shadcn/Base UI source.
2. Express the board through semantic tokens and closed variants, not page-level style overrides.
3. Repeated, domain-free anatomy becomes a composite.
4. Query-free screen structure becomes a template.
5. QUESTPIE collections, TanStack Query, and Channels stay outside `packages/ui`.
6. Apps import only the public `@questpie/ui` surface.

The implementation layers are:

| Layer | Location | Owns |
| --- | --- | --- |
| Foundation | `src/styles.css` | semantic roles, type, dimensions, motion, adaptive selectors |
| CLI UI | `src/components/ui` | official shadcn/Base UI source and its closed primitive variants |
| Composite | `src/components/composites` | reusable domain-free product anatomy |
| AI presentation | `src/components/ai` | Agent/Run/permission/recap projection only |
| Template | `src/components/templates` | query-free shell, list, detail, Channel, settings composition |

## 2. Foundation mapping

| Wireframe role | Production token/API | Tailwind/shadcn role | Current action |
| --- | --- | --- | --- |
| paper canvas | `--canvas` | `background`, `bg-background` | lock to `#FBF9F5` |
| white workspace | `--surface` | `card`, `bg-card` | keep white, use as main working pane |
| sunk warm fill | `--surface-muted` | `secondary`, `muted` | use for neutral controls/status backgrounds |
| selected warm fill | `--surface-selected` | `accent` | lock to `#ECE6DC`; remove blue selection |
| warm rail | `--canvas-subtle` / sidebar role | `sidebar` | lock to `#F7F3EC` |
| primary ink | `--ink` | `foreground` | lock to `#1C1A17` |
| muted/subtle ink | `--ink-muted`, `--ink-faint` | `muted-foreground` plus explicit faint role | dark faint must remain AA for 11px copy |
| hairlines | `--hairline`, `--border` | `border`, `input` | use subtle/default/strong hierarchy |
| CTA coral | `--action` | `primary` | lock to `#F26A45` and primary glow |
| Agent tint/ink | `--agent-tint`, `--agent-ink` | custom semantic utilities | same coral family; no violet |
| status hues | attention/success/danger/info roles | custom semantic utilities | always paired with labels |
| UI font | `--font-sans` | Tailwind `font-sans` | bundled Geist Variable 5.3.0 |
| technical font | `--font-mono` | Tailwind `font-mono` | bundled JetBrains Mono Variable 5.3.0 |
| desktop control | `--control-md: 2rem` | default Button/Input height | 32px |
| touch target | `--touch-target: 2.75rem` | coarse-pointer minimum | 44px; selection rows 48px |
| rail width | `--shell-rail: 14.75rem` | Sidebar provider width | 236px |
| topbar height | `--shell-topbar: 3.8125rem` | SpaceContext minimum | 61px |

## 3. Primitive mapping

### 3.1 Actions and feedback

| Canonical element | Official primitive | `@questpie/ui` public seam | Mapping notes |
| --- | --- | --- | --- |
| coral advancing action | shadcn `Button` | `Button variant="default"` | 32px, 14–15px semibold, 10–14px radius, coral glow; maximum one active per screen state |
| soft neutral action | shadcn `Button` | `Button variant="secondary"` | sunk warm fill, no border/lift |
| bordered trigger | shadcn `Button` | `Button variant="outline"` | hairline and white/paper surface |
| quiet row action | shadcn `Button` | `Button variant="ghost"` | transparent, neutral hover |
| destructive/caution action | shadcn `Button` | `Button variant="destructive"` | quiet tint + explicit label; confirm when irreversible |
| pending action | shadcn `Spinner` + `Button` | composition | Spinner has `data-icon`, Button is disabled, label remains meaningful |
| icon-only action | shadcn `Button` | `size="icon"` / compact icon sizes | 30–32px desktop, 44px coarse, accessible label required |
| completed/recoverable feedback | shadcn `Sonner` | `Toaster` + exported toast adapter | never replaces a durable Run/permission/error state |

### 3.2 Labels and state

| Canonical element | Official primitive | Product seam | Mapping notes |
| --- | --- | --- | --- |
| neutral pill/count | shadcn `Badge` | `Badge secondary|outline` | counts stay mono/tabular; no free color API |
| lifecycle chip | shadcn `Badge` | `Status` composite | visible label + dot + optional elapsed/meta |
| technical tag | shadcn `Badge` or semantic code span | `Tag` composite only if repeated API is needed | 18px, 11px mono, scope/error-class semantics |
| keyboard shortcut | shadcn `CommandShortcut` | command composition | 11px mono; no additional primitive needed |
| Agent provenance | shadcn `Badge` | `AgentProvenance` composite | coral tint/ink and Agent identity/effect copy |
| offline/replay/group band | no behavioral primitive needed | `StateBand` composite | role status, compact full-width band, mono replay meta |

### 3.3 Fields

| Canonical element | Official primitive | Product seam | Mapping notes |
| --- | --- | --- | --- |
| label/help/error group | shadcn `FieldGroup`, `Field` | same public exports | label, description, `data-invalid`, FieldError |
| text control | shadcn `Input` | same | 32px desktop; 16px coarse pointer |
| search/command input | shadcn `InputGroup` | same | `InputGroupInput` + Addon icon only |
| multiline input | shadcn `Textarea` | same | 14px radius, minimum 44px, error retains content |
| boolean setting | shadcn `Switch` / `Checkbox` | same | Switch selected state is neutral ink, not CTA coral |
| small option set | shadcn `ToggleGroup` | same | Base UI array value contract; 2–7 choices |
| predefined selection | shadcn `Select` | `AdaptiveSelect` composite | anchored Base UI listbox ≥768; Sheet buttons <768 |
| searchable selection | shadcn `Combobox` | `AdaptiveCombobox` composite | anchored search/list ≥768; Sheet with focused search <768 |
| mention-aware input | shadcn Field/InputGroup pieces | `MessageComposer` | stores Actor nodes/ids, not Markdown offsets; ordinary replies are not Steering |
| write-only secret | shadcn `Input`, `Field` | settings composite | never render persisted value; mask only as state |

### 3.4 Structure and rows

| Canonical element | Official primitive | Product seam | Mapping notes |
| --- | --- | --- | --- |
| flat/bounded/floating surface | shadcn `Card` | `Surface level="flat|raised|overlay"` | flat default; Card composition only for bounded objects |
| ruled work/object row | shadcn `Checkbox`, Avatar, Button | `ObjectRow` + `WorkRowDetail` | stable checkbox → status → tag → title → typed projections order; activation is separate from nested controls |
| simple settings/list row | shadcn `Item` | `ListRow` | use when lifecycle/Actor anatomy is absent |
| selection context | shadcn Checkbox + Button | `SelectionBar` | 44px; ink checkbox; neutral bulk actions; selection scope is data |
| state group heading | semantic group header + shadcn Badge/Button | `StateGroup` composite | 46px sticky typed group; owns ObjectRows and optional QuickAddRow; no arbitrary child slot |
| quick capture | semantic Button | `QuickAddRow` | ordinary ruled row, neutral action, optional keyboard hint |
| virtualized remainder | semantic status copy | `VirtualizationTail` | non-sticky 42px tail; count and loading contract remain external data |
| separator | shadcn `Separator` | same | never a raw `<hr>`/border-only div in product source |
| local tabs | shadcn `Tabs` | same | neutral underline anatomy |
| routed Space facets | shadcn `Tabs` behavior or semantic route links | `SpaceFacetNav` template | canonical order, one active facet, counts supplied as data |
| list toolbar presets | shadcn `ToggleGroup`, Button, InputGroup | `ObjectViewBar` template | selected presets warm neutral; one coral create action |
| loading row/object | shadcn `Skeleton` | template-specific skeleton | matches final geometry, `aria-busy` on owning region |

### 3.5 Identity

| Canonical element | Official primitive | Product seam | Mapping notes |
| --- | --- | --- | --- |
| Human/Agent avatar | shadcn `Avatar` | `ActorMark` | always `AvatarFallback`; circular parity; Agent uses quiet tint/ink and no robot icon |
| Actor identity | Avatar + semantic text | `ActorIdentity` | borderless identical Human/Agent geometry, name, role, presence, availability |
| overlapping presence | Avatar group composition | `ActorStack` | 6px overlap; cap visible members and expose `+N` when a template needs overflow |
| inline Actor reference | Badge-like semantic token | `ActorMention` AI/chat composite | agent tint vs human neutral; stores Actor id |

### 3.6 Overlays

| Canonical element | Desktop primitive | Mobile primitive | Product seam |
| --- | --- | --- | --- |
| row/menu actions | shadcn `DropdownMenu` | shadcn `Drawer` as bottom Sheet | `AdaptiveMenu` |
| select | shadcn `Select` | `Drawer` Sheet of ordinary buttons | `AdaptiveSelect` |
| combobox | shadcn `Combobox` | `Drawer` Sheet with search | `AdaptiveCombobox` |
| contextual info | shadcn `Popover` | titled `Drawer` Sheet | `AdaptivePopover` |
| essential tooltip disclosure | shadcn `Tooltip` / Popover | titled `Drawer` Sheet | `AdaptiveTooltip` |
| focused modal | shadcn `Dialog` | `Drawer` Sheet | `AdaptiveModal` |
| confirmation | shadcn `AlertDialog` | `Drawer` Sheet | `AdaptiveConfirm` |
| detail/nav side panel | shadcn `Sheet` or `Drawer` by gesture need | edge Drawer | typed template/controller |
| command palette | shadcn `Command` in Dialog | Command in titled Sheet | `CommandPalette` composite/template |

`Drawer` is the installed Base UI-backed mobile bottom-Sheet mechanism. Product code must not create a second `Sheet` anatomy or branch at the caller.

## 4. Shell and template mapping

| Canonical composition | Official pieces | Production template | Contract |
| --- | --- | --- | --- |
| Company rail + workspace | shadcn Sidebar family, Drawer, Button | `CompanyShell` | one grouped navigation config drives desktop rail, mobile Drawer, bottom nav |
| rail grouped nav | SidebarGroup/Menu/Badge | `CompanyShellNavigation` | attention → Spaces → Channels → direct Actors → resources |
| Space topbar | Button, Badge, Actor composites | `SpaceContext` | normalized 61px; icon → identity → context → actions |
| Space facets | Tabs / typed route links | `SpaceFacetNav` | fixed order and one active facet |
| object list | InputGroup, ToggleGroup, ObjectRow, Skeleton, StatePanel | `ObjectList` template | one `ObjectListProjection` + typed `ObjectListAction` seam; context → connection → facets → viewbar → selection → typed StateGroups → virtualized tail |
| object detail + context | headers, readable surface, Thread controller | `DocumentDetail` | readable body + adaptive contextual Thread/evidence |
| Channel/DM | MessageScroller behavior, authored Message composite, Marker, Composer | `ChannelThread` | Slack-like authored rows with Markdown and typed work blocks; never chatbot bubbles |
| settings | FieldGroup, Field, Status, Button | `SettingsForm` | grouped ruled settings sections + explicit footer |
| universal states | Empty, Alert, Skeleton | `StatePanel` | separate empty/no-results/error/access; inline error stays local |

## 5. AI presentation mapping

| Canonical Agent element | Official pieces | Production module | Contract |
| --- | --- | --- | --- |
| Agent-authored Message | MessageScroller behavior, `ActorMark`, Markdown renderer, typed work blocks | `AuthoredMessage` projection | same unboxed anatomy as Human; explicit Agent provenance |
| semantic plan/activity | Item, Status, Separator, Collapsible when needed | `RunPlan` composite | human-readable grouped steps; no raw tool dump |
| bounded live summary | Surface/Item, ActorIdentity, Status, Button | replace generic `RunCard` with `RunSummary` anatomy | bounded summary; latest semantic group; elapsed; at most one action |
| full Run history | Tabs, Item, Marker, Empty | `RunDetail` | activity, evidence, permissions, attempts, steering |
| permission request | Alert, Button, Separator | `PermissionGate` composite | requested effect, scope, reason, allow/deny, durable status |
| live transient transport | Status/Marker | `AiSdkRunStream` adapter | only submitted/streaming/ready/error; never source of durable truth |
| reconnect/replay | StateBand | Channel/Run template slot | replay count/cursor and honest reconnect copy |
| recap/provenance | Message, Badge, Attachment/Item | `RunRecap` composite | effect result, evidence, output link, Agent identity |
| steering | Field/InputGroup, Button, Status | Phase-1 `RunSteeringComposer` only | explicit durable Run command at a safe boundary; never an ordinary Thread reply and never `useChat.stop()` |

## 6. Current mismatch and remediation matrix

| Current module | Mismatch | Remediation before Storybook ratification |
| --- | --- | --- |
| `styles.css` | rejected Inter/blue/violet values were present | Geist/JetBrains and warm paper/coral contract added; finish exact dark and typography roles |
| `Button` | upstream Nova geometry is close; missing canonical coral glow and final hover/active polish | adjust semantic tokens/closed variants, preserve Base UI behavior |
| `Badge` / `Status` | status backgrounds are heavier than board dot+neutral chip in some states | normalize Status anatomy and stories |
| `Input` / Field family | behavior is correct; computed 32px/radius/type/focus not yet ratified | add exact stories and computed assertions |
| Actor identity family | the rejected pass used large bordered pills and a custom square Agent mark | use circular `ActorMark`, borderless `ActorIdentity`, overlapping `ActorStack`; reserve `ActorChip` for selected/removable tokens |
| `Surface` | current `rounded-xl`/Card-first usage is too generic | map radius and restrict raised use to bounded objects |
| `ListRow` | too generic for canonical work state anatomy | use new `ObjectRow` for work; retain ListRow for simple lists/settings |
| retired `AppShell` | flat navigation array, 256px/white historical visual | removed from the public kit; grouped `CompanyShell` is the single shell contract |
| `PageHeader` | roomy 24px page title and large padding inside shell | replace shell usage with `SpaceContext`; reserve PageHeader for true page hierarchy |
| retired `CollectionPage` | generic search + rows + pagination, missing bands/viewbar/facets | removed from the public kit; typed `ObjectList` owns the work-list grammar |
| `ObjectList` Work seam | the visual anatomy is canonical, but generic row props can still represent contradictory Task status, selection, assignee, pagination, and list/board states | keep the domain-free composites; add the separately tracked exhaustive Task queue projection before Phase-0 data integration |
| `ChannelThread` | authored start-aligned rows, secure Markdown, structured mentions, ordinary MessageComposer, and typed work parts are implemented | finish normalized persisted document validation, unsupported-part fallback, transient transport adapter, and contextual Thread disclosure |
| `RunCard` | flat fixed 144px Run summary with Actor parity, two bounded semantic rows, grouped hidden activity, and one detail action is implemented | finish permission/failure/reconnect/terminal action families; full detail owns expansion and raw evidence |
| adaptive wrappers | shared Menu→Sheet, modal→Sheet and command Dialog→Drawer mechanisms are implemented | exact 767/768 stories, focus restoration, coarse targets and safe-area behavior are required on every consuming composite |
| command palette | the official `Command` primitive and canonical reference composition are implemented | keep the typed query-free projection: grouped results, scoped create, Actor parity and one coral generative catch-all; desktop Dialog becomes a mobile Drawer below 768 |

## 7. Storybook mapping order

1. Foundations: surfaces, color, Geist/mono roles, spacing, radius, hairline, elevation, focus, motion.
2. CLI UI: Button, Badge, Input, Field, Textarea, Switch, Tabs, menu/select/command, Dialog/Drawer/Sheet.
3. Product composites: Status, Actor, StateBand, StateGroup, ObjectRow, adaptive overlays.
4. AI presentation: Message family, Run plan/summary/detail, permission, reconnect, recap, steering.
5. Templates: CompanyShell, SpaceContext, facets, ObjectList, Channel, detail + Thread.
6. Reference screens: canonical desktop/mobile shell, Channel, live Task Run, permission gate, command palette.

No product route begins until this mapped reference set passes independent visual ratification.
