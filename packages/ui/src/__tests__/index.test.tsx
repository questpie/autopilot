import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	ActivityIcon,
	BookOpenIcon,
	HouseIcon,
	InboxIcon,
	LayoutGridIcon,
	LayoutListIcon,
	SettingsIcon,
	TargetIcon,
	UserRoundIcon,
} from "lucide-react";

import {
	ActorChip,
	AdaptiveModal,
	AdaptiveSelect,
	AiSdkRunStream,
	Badge,
	Breadcrumb,
	Button,
	Combobox,
	ComboboxInput,
	CompanyShell,
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	Input,
	ListRow,
	ObjectRow,
	ObjectList,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
	RunCard,
	RunDetail,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	Spinner,
	StatePanel,
	StateBand,
	SpaceContext,
	Status,
	Surface,
	Tabs,
	TabsList,
	TabsTrigger,
} from "../index";

describe("@questpie/ui public design kit", () => {
	it("locks the canonical wireframe typography, palette, and dense shell metrics", () => {
		const styles = readFileSync(new URL("styles.css", import.meta.url), "utf8");
		const designContract = readFileSync(
			new URL("../../../DESIGN-SYSTEM.md", import.meta.url),
			"utf8",
		);

		expect(styles).toContain('@import "@fontsource-variable/geist"');
		expect(styles).toContain('@import "@fontsource-variable/jetbrains-mono"');
		expect(styles).not.toContain("@fontsource-variable/inter");
		expect(styles).toContain("--canvas: #fbf9f5");
		expect(styles).toContain("--surface: #ffffff");
		expect(styles).toContain("--surface-selected: #ece6dc");
		expect(styles).toContain("--hairline: #eee8dd");
		expect(styles).toContain("--border: #e4dcce");
		expect(styles).toContain("--border-strong: #d3c8b7");
		expect(styles).toContain("--action: #f26a45");
		expect(styles).toContain("--agent: #f26a45");
		expect(styles).toContain("--shell-rail: 14.75rem");
		expect(styles).toContain("--shell-topbar: 3.8125rem");
		expect(styles).toContain("--control-md: 2rem");
		expect(styles).toContain("--radius-sm: 0.625rem");
		expect(styles).toContain("--radius-md: 0.875rem");
		expect(styles).toContain("--radius-lg: 1.125rem");
		expect(styles).toContain("--font-mono:");
		expect(styles).toContain("font-size: 0.875rem");
		expect(styles).toContain("line-height: 1.5");

		expect(designContract).toContain("autopilot-operator-web-product-wireframes");
		expect(designContract).toContain("Geist");
		expect(designContract).toContain("JetBrains Mono");
		expect(designContract).toContain("236px");
		expect(designContract).toContain("61px");
		expect(designContract).not.toContain("Warm Operational Flat");
	});

	it("ships Slovak accessible-name defaults through the public primitive seam", () => {
		const markup = renderToStaticMarkup(
			<>
				<Spinner />
				<Breadcrumb />
				<Combobox items={[]}>
					<ComboboxInput />
				</Combobox>
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious href="#predchadzajuca" />
						</PaginationItem>
						<PaginationItem>
							<PaginationNext href="#nasledujuca" />
						</PaginationItem>
					</PaginationContent>
				</Pagination>
				<SidebarProvider>
					<SidebarTrigger />
					<SidebarRail />
				</SidebarProvider>
			</>,
		);

		expect(markup).toContain('data-slot="spinner"');
		expect(markup).toContain('aria-hidden="true"');
		expect(markup).toContain('aria-label="Omrvinková navigácia"');
		expect(markup).toContain('aria-label="Otvoriť možnosti"');
		expect(markup).toContain('aria-label="Stránkovanie"');
		expect(markup).toContain('aria-label="Prejsť na predchádzajúcu stranu"');
		expect(markup).toContain('aria-label="Prejsť na nasledujúcu stranu"');
		expect(markup).toContain('aria-label="Prepnúť bočný panel"');
		expect(markup).not.toMatch(
			/aria-label="(?:Loading|breadcrumb|pagination|Go to previous page|Go to next page|Toggle Sidebar|Open options|Clear selection)"/,
		);
	});

	it("renders CLI actions and semantic status without custom loading props", () => {
		const markup = renderToStaticMarkup(
			<Surface level="flat">
				<Button disabled>
					<Spinner data-icon="inline-start" />
					Ukladá cieľ
				</Button>
				<Badge variant="secondary">Agent</Badge>
				<Status state="running" label="Pracuje" elapsed="2 min" />
			</Surface>,
		);

		expect(markup).toContain("disabled");
		expect(markup).toContain('data-slot="spinner"');
		expect(markup).toContain('aria-hidden="true"');
		expect(markup).not.toContain("Loading");
		expect(markup).toContain('data-status="running"');
		expect(markup).toContain("Pracuje");
	});

	it("keeps descriptive badges neutral and reserves filled coral for advancing buttons", () => {
		const badge = renderToStaticMarkup(<Badge>3</Badge>);
		const action = renderToStaticMarkup(<Button>Vytvoriť cieľ</Button>);

		expect(badge).toContain("bg-secondary");
		expect(badge).not.toContain("bg-primary");
		expect(action).toContain("bg-primary");
		expect(action).toContain("shadow-[var(--button-primary-shadow)]");
		expect(action).toContain("rounded-[var(--radius-md)]");
	});

	it("maps Select and line Tabs to the canonical 32px control and neutral facet grammar", () => {
		const options = [
			{ label: "E-shop", value: "eshop" },
			{ label: "Financie", value: "finance" },
		];
		const select = renderToStaticMarkup(
			<Select items={options} defaultValue="eshop">
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{options.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>,
		);
		const tabs = renderToStaticMarkup(
			<Tabs defaultValue="tasks">
				<TabsList variant="line">
					<TabsTrigger value="overview">Prehľad</TabsTrigger>
					<TabsTrigger value="tasks">Úlohy</TabsTrigger>
				</TabsList>
			</Tabs>,
		);
		const selectSource = readFileSync(new URL("components/ui/select.tsx", import.meta.url), "utf8");

		expect(select).toContain("h-8");
		expect(select).toContain("bg-surface");
		expect(select).toContain("rounded-[var(--radius-sm)]");
		expect(select).toContain("text-[0.9375rem]");
		expect(selectSource).toContain("min-h-10");
		expect(selectSource).toContain("rounded-[var(--radius-sm)]");
		expect(tabs).toContain('data-variant="line"');
		expect(tabs).toContain("text-[length:var(--type-md)]");
		expect(tabs).toContain("after:h-0.5");
		expect(tabs).not.toContain("text-primary");
	});

	it("keeps public accessibility defaults Slovak and decorative spinners silent", () => {
		const labelledSpinner = renderToStaticMarkup(<Spinner aria-label="Načítava sa" />);
		expect(labelledSpinner).toContain('role="status"');
		expect(labelledSpinner).toContain('aria-label="Načítava sa"');

		const sourceFiles = [
			"components/ui/dialog.tsx",
			"components/ui/sheet.tsx",
			"components/ui/sidebar.tsx",
			"components/ui/combobox.tsx",
			"components/ui/pagination.tsx",
			"components/ui/message-scroller.tsx",
			"components/ui/breadcrumb.tsx",
			"components/ui/spinner.tsx",
		];
		const source = sourceFiles
			.map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
			.join("\n");

		for (const leakedDefault of [
			'"Loading"',
			'"Close"',
			">Close<",
			'"Toggle Sidebar"',
			'"Open options"',
			'"Clear selection"',
			'"Go to previous page"',
			'"Go to next page"',
			'"More pages"',
			'"Scroll to end"',
			'"Scroll to start"',
			">Sidebar<",
			">Displays the mobile sidebar.<",
		]) {
			expect(source).not.toContain(leakedDefault);
		}
	});

	it("preserves Human and Agent geometry while exposing provenance", () => {
		const human = renderToStaticMarkup(
			<ActorChip actor={{ id: "a1", name: "Marek Drepovský", kind: "human" }} />,
		);
		const agent = renderToStaticMarkup(
			<ActorChip actor={{ id: "a2", name: "Autopilot", kind: "agent" }} />,
		);

		expect(human).toContain('data-slot="actor-chip"');
		expect(human).toContain('data-kind="human"');
		expect(agent).toContain('data-kind="agent"');
	});

	it("keeps Actor accessibility copy localized and avoids prohibited ARIA on presence", () => {
		const markup = renderToStaticMarkup(
			<ActorChip
				actor={{ id: "a2", name: "Autopilot", kind: "agent" }}
				presence="online"
				availability="suspended"
				pickerMode
				onRemove={() => undefined}
			/>,
		);

		expect(markup).toContain("AI aktér");
		expect(markup).toContain("Online");
		expect(markup).toContain("Pozastavený");
		expect(markup).toContain('aria-label="Odobrať Autopilot"');
		expect(markup).not.toContain('aria-label="online"');
		expect(markup).not.toContain('aria-label="Agent"');
	});

	it("connects FieldGroup and Field semantics to the input", () => {
		const markup = renderToStaticMarkup(
			<FieldGroup>
				<Field data-invalid>
					<FieldLabel htmlFor="space-name">Názov priestoru</FieldLabel>
					<FieldDescription>Viditeľný pre členov.</FieldDescription>
					<Input id="space-name" name="space-name" aria-invalid />
					<FieldError>Názov je povinný.</FieldError>
				</Field>
			</FieldGroup>,
		);

		expect(markup).toContain('for="space-name"');
		expect(markup).toContain('aria-invalid="true"');
		expect(markup).toContain("Názov je povinný.");
	});

	it("supports controlled and uncontrolled adaptive select values", () => {
		const options = [
			{ value: "sonnet", label: "Claude Sonnet" },
			{ value: "opus", label: "Claude Opus" },
		];
		const uncontrolled = renderToStaticMarkup(
			<AdaptiveSelect label="Model" options={options} defaultValue="sonnet" />,
		);
		const controlled = renderToStaticMarkup(
			<AdaptiveSelect label="Model" options={options} value="opus" />,
		);

		expect(uncontrolled).toContain("Claude Sonnet");
		expect(controlled).toContain("Claude Opus");
	});

	it("allows a controlled adaptive modal without a trigger", () => {
		const markup = renderToStaticMarkup(
			<AdaptiveModal title="Detail behu" open onOpenChange={() => undefined}>
				Časová os
			</AdaptiveModal>,
		);

		expect(markup).not.toContain('data-slot="drawer-trigger"');
	});

	it("projects only safe transient AI SDK transport state", () => {
		const running = renderToStaticMarkup(
			<AiSdkRunStream bridge={{ status: "streaming", error: undefined }} />,
		);
		const error = renderToStaticMarkup(
			<AiSdkRunStream bridge={{ status: "error", error: new Error("secret server detail") }} />,
		);

		expect(running).toContain('data-ai-sdk-transient="true"');
		expect(running).not.toContain("Stop");
		expect(error).not.toContain("secret server detail");
		expect(error).toContain("Beh môže stále pokračovať");
	});

	it("keeps the RunCard summary bounded and sends detail to disclosure", () => {
		const markup = renderToStaticMarkup(
			<RunCard
				run={{
					id: "run-1",
					actor: { id: "a2", name: "Autopilot", kind: "agent" },
					elapsed: "2 min",
					activity: "Použil 4 nástroje — naposledy prehľadal Znalosti",
					state: {
						kind: "live",
						phase: "working",
						phaseLabel: "Pracuje",
						currentAction: "Píše návrh",
					},
				}}
				onOpenDetail={() => undefined}
			/>,
		);

		expect(markup).toContain('data-fixed-height="true"');
		expect(markup).toContain("Použil 4 nástroje");
		expect(markup).toContain("Zobraziť detail behu");
	});

	it("renders the closed Run terminal family and grounded completed provenance", () => {
		const actor = { id: "actor-autopilot", name: "Autopilot", kind: "agent" as const };
		const operator = { id: "actor-marek", name: "Marek H.", kind: "human" as const };
		const baseRun = {
			id: "run-newsletter-01",
			actor,
			activity: "Zhrnul 4 kroky · naposledy pripravil návrh",
		};
		const states = [
			{
				kind: "live",
				phase: "working",
				phaseLabel: "Pracuje",
				currentAction: "Pripravuje návrh newslettera",
			},
			{
				kind: "waiting-permission",
				permission: {
					id: "permission-publish-01",
					capability: "Publikovať newsletter",
					scope: "E-shop · draft newsletter-01",
					consequence: "Obsah sa odošle 4 281 odberateľom.",
					requestedBy: actor,
					decision: "pending",
					canDecide: false,
				},
			},
			{ kind: "failed", summary: "Publikovanie zlyhalo.", retryLabel: "Skúsiť znova" },
			{ kind: "reconnecting", label: "Obnovuje spojenie", replayLabel: "Čaká na replay" },
			{ kind: "cancelled", reason: "Zrušil Marek H.", cancelledAt: "09:47", cancelledBy: operator },
			{
				kind: "completed",
				recap: {
					summary: "Newsletter je pripravený na kontrolu.",
					items: [
						{
							id: "effect-newsletter-draft-01",
							kind: "effect",
							label: "Aktualizoval draft newslettera",
							referenceId: "newsletter-draft-01",
							actor,
							occurredAt: "09:48",
						},
						{
							id: "output-copy-01",
							kind: "output",
							label: "Text newslettera",
							referenceId: "artifact-copy-01",
							actor,
							occurredAt: "09:48",
						},
						{
							id: "evidence-tone-01",
							kind: "evidence",
							label: "Tón značky Hrebeň",
							referenceId: "knowledge-tone-01",
							actor,
							occurredAt: "09:46",
						},
					],
				},
			},
		] as const;

		const summaries = states.map((state) =>
			renderToStaticMarkup(
				<RunCard
					run={{ ...baseRun, state }}
					onOpenDetail={() => undefined}
					onRetry={state.kind === "failed" ? () => undefined : undefined}
				/>,
			),
		);
		for (const [index, kind] of states.map((state) => state.kind).entries()) {
			expect(summaries[index]).toContain(`data-run-state="${kind}"`);
			expect(summaries[index]).toContain('data-slot="work-block"');
			expect(summaries[index]).toContain('data-part="run-summary"');
		}
		expect(summaries[0].match(/data-slot="run-current-action"/g)).toHaveLength(1);
		expect(summaries[2]).toContain("Skúsiť znova");
		expect(summaries[2]).toContain("Zobraziť detail behu");
		expect(summaries[2]).not.toContain("Newsletter je pripravený");
		expect(summaries[3]).not.toContain("Zrušen");
		expect(summaries[4]).toContain("Zrušil Marek H.");

		const detail = renderToStaticMarkup(
			<RunDetail
				projection={{
					run: { ...baseRun, state: states[5] },
					groups: [],
					permissions: [],
					attempts: [],
				}}
				onAction={() => undefined}
			/>,
		);
		expect(detail).toContain("newsletter-draft-01");
		expect(detail).toContain("artifact-copy-01");
		expect(detail).toContain("knowledge-tone-01");
		expect(detail.match(/Autopilot/g)?.length).toBeGreaterThanOrEqual(3);
	});

	it("renders list and universal states as named semantic regions", () => {
		const markup = renderToStaticMarkup(
			<>
				<ListRow identity="Pripraviť ponuku" meta="Dnes" />
				<StatePanel
					state="no-results"
					title="Žiadne výsledky"
					description="Skúste zmeniť filtre."
				/>
			</>,
		);

		expect(markup).toContain("Pripraviť ponuku");
		expect(markup).toContain('data-state="no-results"');
		expect(markup).toContain("Skúste zmeniť filtre.");
	});

	it("composes the canonical StateBand and ruled ObjectRow through the public seam", () => {
		const markup = renderToStaticMarkup(
			<section>
				<StateBand tone="live" label="Offline — obnovujem spojenie…" meta="replay · 8 udalostí" />
				<ObjectRow
					id="landing"
					title="Landing sekcia — hero + prehľad kolekcie"
					progress={{ completed: 5, total: 8, dueLabel: "o 12 dní" }}
					actors={[
						{
							actor: { id: "autopilot", name: "Autopilot", kind: "agent" },
							presence: "online",
						},
					]}
				/>
			</section>,
		);

		expect(markup).toContain('data-slot="state-band"');
		expect(markup).toContain('data-tone="live"');
		expect(markup).toContain("replay · 8 udalostí");
		expect(markup).toContain('data-slot="work-object-row"');
		expect(markup).toContain('data-progress="5/8"');
		expect(markup).toContain("Landing sekcia");
		expect(markup).toContain('data-kind="agent"');
	});

	it("renders the canonical Company shell groups and Space context from one navigation model", () => {
		const markup = renderToStaticMarkup(
			<CompanyShell
				companyName="Hrebeň"
				activeId="general"
				actor={{ id: "marek", name: "Marek H.", kind: "human" }}
				commandLabel="Hľadať alebo vyvolať"
				createLabel="Vytvoriť"
				onCreate={() => undefined}
				mobileContext={{ label: "E-shop", icon: LayoutGridIcon }}
				sections={[
					{
						id: "attention",
						items: [
							{
								kind: "attention",
								id: "home",
								label: "Domov",
								icon: HouseIcon,
								mobileSlot: "home",
							},
							{
								kind: "attention",
								id: "inbox",
								label: "Potrebuje ťa",
								icon: InboxIcon,
								badge: 3,
								mobileSlot: "inbox",
							},
							{ kind: "attention", id: "activity", label: "Aktivita", icon: ActivityIcon },
						],
					},
					{
						id: "spaces",
						label: "Priestory",
						items: [
							{ kind: "space", id: "eshop", label: "E-shop", memberCount: 5 },
							{
								kind: "space",
								id: "all-spaces",
								label: "Všetky priestory",
								icon: LayoutGridIcon,
								mobileSlot: "spaces",
							},
						],
					},
					{
						id: "channels",
						label: "Kanály",
						items: [{ kind: "channel", id: "general", label: "general", unreadCount: 2 }],
					},
					{
						id: "actors",
						label: "Priame správy",
						items: [
							{
								kind: "direct",
								id: "autopilot",
								label: "Autopilot",
								actor: { id: "autopilot", name: "Autopilot", kind: "agent" },
								presence: "online",
							},
						],
					},
					{
						id: "resources",
						items: [
							{ kind: "resource", id: "library", label: "Knižnica", icon: BookOpenIcon },
							{ kind: "resource", id: "settings", label: "Nastavenia", icon: SettingsIcon },
							{
								kind: "direct",
								id: "self",
								label: "Ja",
								actor: { id: "marek", name: "Marek H.", kind: "human" },
								icon: UserRoundIcon,
								mobileSlot: "self",
							},
						],
					},
				]}
			>
				<SpaceContext title="E-shop" project="E-shop" meta="5 členov · 1 agent" />
			</CompanyShell>,
		);

		expect(markup).toContain('data-slot="company-shell"');
		expect(markup).toContain('data-slot="company-rail"');
		expect(markup).toContain("Hľadať alebo vyvolať");
		expect(markup).toContain("Priestory");
		expect(markup).toContain("Kanály");
		expect(markup).toContain("lucide-hash");
		expect(markup).toContain(">general<");
		expect(markup).toContain("Priame správy");
		expect(markup).toContain("Autopilot");
		expect(markup).toContain('data-kind="space"');
		expect(markup).toContain('data-kind="channel"');
		expect(markup).toContain('data-kind="direct"');
		expect(markup).toContain('data-slot="company-actor-identity"');
		expect(markup).toContain('data-part="mobile-create"');
		expect(markup).toContain('aria-label="Vytvoriť"');
		expect(markup).toContain('data-mobile-slot="home"');
		expect(markup).toContain('data-mobile-slot="spaces"');
		expect(markup).toContain('data-mobile-slot="inbox"');
		expect(markup).toContain('data-mobile-slot="self"');
		expect(markup).toContain('data-slot="space-context"');
		expect(markup).toContain("5 členov · 1 agent");
	});

	it("composes the canonical query-free work list template from typed projections", () => {
		const markup = renderToStaticMarkup(
			<ObjectList
				projection={{
					context: {
						icon: LayoutGridIcon,
						title: "E-shop",
						project: { label: "Projekt", value: "E-shop" },
						meta: "5 členov · 1 agent",
						members: [
							{ actor: { id: "marek", name: "Marek H.", kind: "human" }, presence: "online" },
							{ actor: { id: "autopilot", name: "Autopilot", kind: "agent" }, presence: "online" },
						],
						inviteLabel: "Pozvať",
					},
					connection: {
						tone: "attention",
						label: "Offline — obnovujem spojenie…",
						meta: "Last-Event-ID · replay 12 udalostí",
					},
					facets: {
						activeId: "tasks",
						facets: [
							{ id: "tasks", label: "Úlohy", icon: LayoutListIcon, count: 12 },
							{ id: "goals", label: "Ciele", icon: TargetIcon, count: 5 },
						],
					},
					view: {
						presets: [
							{ id: "needs-you", label: "Potrebuje ťa", icon: InboxIcon },
							{ id: "running", label: "Beží", tone: "live" },
						],
						activePresetId: "needs-you",
						groupLabel: "Zoskupiť: Stav",
						filterLabel: "Filter",
						sortLabel: "Zoradiť: Priorita",
						searchLabel: "Hľadať úlohu…",
						displayMode: "list",
						createLabel: "Nová úloha",
					},
					body: {
						kind: "ready",
						mode: "list",
						groups: [
							{
								id: "active",
								label: "Aktívne",
								count: 1,
								items: [
									{
										id: "landing",
										title: "Landing sekcia — hero + prehľad kolekcie",
										progress: { completed: 5, total: 8, dueLabel: "o 12 dní" },
										actors: [{ actor: { id: "autopilot", name: "Autopilot", kind: "agent" } }],
									},
								],
							},
						],
					},
				}}
			/>,
		);

		expect(markup).toContain('data-slot="object-list"');
		expect(markup).toContain('data-slot="object-view-bar"');
		expect(markup).toContain('data-slot="state-group"');
		expect(markup).toContain('data-slot="work-object-row"');
		expect(markup).toContain('data-progress="5/8"');
		expect(markup).toContain("Last-Event-ID · replay 12 udalostí");
		// Both authored tool shapes stay in SSR markup; container/media rules choose the visible mode
		// without a hydration-time viewport branch.
		expect(markup).toContain("Nástroje úloh");
		expect(markup).toContain("Nová úloha");
		expect(markup).toContain("Landing sekcia");
		expect(markup).toContain('data-kind="agent"');
		expect(markup).toContain('data-slot="state-group-header"');
	});
});
