import {
	ActorChip,
	AdaptiveCombobox,
	AdaptiveConfirm,
	AdaptiveMenu,
	AdaptiveModal,
	AdaptivePopover,
	AdaptiveSelect,
	AdaptiveTooltip,
	ListRow,
	Status,
	Surface,
} from "./components/composites";
import { ChannelThread, MessageComposer, RunCard, RunDetail } from "./components/ai";
import {
	AuthShell,
	CompanyShell,
	DocumentDetail,
	InvitationPanel,
	ObjectList,
	PageHeader,
	SettingsForm,
	SpaceFacetNav,
	StatePanel,
} from "./components/templates";
import {
	Badge,
	Button,
	Checkbox,
	Drawer,
	Field,
	FieldGroup,
	Input,
	RadioGroup,
	Sheet,
	Spinner,
	Switch,
	Tabs,
	Textarea,
	Toaster,
} from "./components/ui";

export type CatalogGroup =
	| "Foundations"
	| "CLI UI"
	| "Product Composites"
	| "AI UI"
	| "Templates"
	| "Shells";

export interface CatalogEntry {
	id: string;
	label: string;
	group: CatalogGroup;
	component: unknown;
	mechanism: string;
}

export const catalogManifest: readonly CatalogEntry[] = [
	{
		id: "tokens",
		label: "Tokens",
		group: "Foundations",
		component: null,
		mechanism: "Bundled Geist/JetBrains roles and canonical warm paper/coral semantics.",
	},
	{
		id: "actions",
		label: "Button, Badge, Spinner",
		group: "CLI UI",
		component: [Button, Badge, Spinner],
		mechanism: "CLI-owned Nova/Base UI components with reviewed variants and sizes.",
	},
	{
		id: "fields",
		label: "Field and inputs",
		group: "CLI UI",
		component: [FieldGroup, Field, Input, Textarea, Checkbox, Switch, RadioGroup],
		mechanism: "FieldGroup and Field own labels, descriptions, and validation semantics.",
	},
	{
		id: "overlay-roots",
		label: "Sheet and Drawer",
		group: "CLI UI",
		component: [Sheet, Drawer],
		mechanism: "CLI-owned overlay mechanisms used by product-level adaptive wrappers.",
	},
	{
		id: "local-navigation",
		label: "Tabs",
		group: "CLI UI",
		component: Tabs,
		mechanism: "Keyboard-navigable local views from the upstream registry.",
	},
	{
		id: "feedback",
		label: "Toast",
		group: "CLI UI",
		component: Toaster,
		mechanism: "Sonner feedback themed through locked semantic CSS variables.",
	},
	{
		id: "identity-status",
		label: "Actor, status, and surface",
		group: "Product Composites",
		component: [ActorChip, Status, Surface],
		mechanism: "Human/Agent parity and label-first operational status.",
	},
	{
		id: "adaptive-overlays",
		label: "Adaptive overlays",
		group: "Product Composites",
		component: [
			AdaptiveMenu,
			AdaptiveSelect,
			AdaptiveCombobox,
			AdaptivePopover,
			AdaptiveTooltip,
			AdaptiveModal,
			AdaptiveConfirm,
		],
		mechanism: "One controlled API changes between mobile sheet and desktop popup at 768px.",
	},
	{
		id: "list-row",
		label: "ListRow",
		group: "Product Composites",
		component: ListRow,
		mechanism: "One activation target with bounded, reusable row anatomy.",
	},
	{
		id: "run",
		label: "RunCard and RunDetail",
		group: "AI UI",
		component: [RunCard, RunDetail],
		mechanism: "Fixed-height progress summary with explicit disclosure into full run history.",
	},
	{
		id: "conversation",
		label: "ChannelThread and MessageComposer",
		group: "AI UI",
		component: [ChannelThread, MessageComposer],
		mechanism: "Upstream chat UI composed with durable, externally supplied channel projections.",
	},
	{
		id: "page-structure",
		label: "Page templates",
		group: "Templates",
		component: [PageHeader, SpaceFacetNav, ObjectList, DocumentDetail, StatePanel],
		mechanism: "Typed query-free assemblies for recurring Phase-0 page structure and states.",
	},
	{
		id: "settings",
		label: "SettingsForm",
		group: "Templates",
		component: SettingsForm,
		mechanism: "FieldGroup-based settings composition with an explicit action footer.",
	},
	{
		id: "auth-shell",
		label: "AuthShell",
		group: "Shells",
		component: AuthShell,
		mechanism:
			"Centered entry/onboarding frame with data-driven step meta, pending-capable footer, inline-error band, and invitation-continuation notice slots.",
	},
	{
		id: "invitation-panel",
		label: "InvitationPanel",
		group: "Shells",
		component: InvitationPanel,
		mechanism:
			"Discriminated invitation-acceptance card for every SPEC 10.0 state: eligible, expired, revoked, already-used, wrong-account, and query/mutation error.",
	},
	{
		id: "company-shell",
		label: "CompanyShell",
		group: "Shells",
		component: CompanyShell,
		mechanism:
			"One semantic navigation config drives the 236px rail, left mobile drawer, and five-slot mobile navigation.",
	},
] as const;
