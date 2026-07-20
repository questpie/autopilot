import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	ActivityIcon,
	BookOpenIcon,
	HouseIcon,
	InboxIcon,
	LayoutGridIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { CompanyShell, type CompanyNavigationSection, TaskList } from "./components/templates";
import { hrebenActors, hrebenTaskListFixture } from "./fixtures/hreben-work";

const { marek, lucia, autopilot } = hrebenActors;
const shellTaskAction = fn();

const sections = [
	{
		id: "attention",
		items: [
			{ kind: "attention", id: "home", label: "Domov", icon: HouseIcon, mobileSlot: "home" },
			{
				kind: "attention",
				id: "inbox",
				label: "Potrebuje ťa",
				mobileLabel: "Pre teba",
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
			{ kind: "space", id: "finance", label: "Financie", memberCount: 2 },
			{ kind: "space", id: "web", label: "Web", memberCount: 4 },
			{
				kind: "space",
				id: "spaces",
				label: "Všetky priestory",
				mobileLabel: "Priestory",
				icon: LayoutGridIcon,
				mobileSlot: "spaces",
			},
		],
	},
	{
		id: "channels",
		label: "Kanály",
		items: [
			{ kind: "channel", id: "general", label: "general" },
			{ kind: "channel", id: "summer", label: "letná-kampaň", unreadCount: 5 },
			{ kind: "channel", id: "reviews", label: "recenzie" },
		],
	},
	{
		id: "direct",
		label: "Priame správy",
		items: [
			{ kind: "direct", id: "autopilot", label: "Autopilot", actor: autopilot, presence: "online" },
			{ kind: "direct", id: "lucia", label: "Lucia", actor: lucia, presence: "away" },
		],
	},
	{
		id: "resources",
		items: [
			{ kind: "resource", id: "library", label: "Knižnica", icon: BookOpenIcon },
			{ kind: "resource", id: "team", label: "Tím", icon: UsersIcon },
			{ kind: "resource", id: "settings", label: "Nastavenia", icon: SettingsIcon },
			{
				kind: "direct",
				id: "self",
				label: "Ja",
				actor: marek,
				presence: "online",
				mobileSlot: "self",
			},
		],
	},
] satisfies readonly CompanyNavigationSection[];

const longCopySections = sections.map((section) =>
	section.id === "channels"
		? {
				...section,
				items: section.items.map((item) =>
					item.id === "summer"
						? {
								...item,
								label: "letná-kampaň-pre-uvedenie-novej-kolekcie-na-celom-Slovensku",
							}
						: item,
				),
			}
		: section,
) satisfies readonly CompanyNavigationSection[];

function ShellWorkspace() {
	return <TaskList projection={hrebenTaskListFixture} onAction={shellTaskAction} />;
}

function HrebenShell({
	companyName = "Hrebeň",
	navigation = sections,
}: {
	companyName?: string;
	navigation?: readonly CompanyNavigationSection[];
} = {}) {
	return (
		<CompanyShell
			companyName={companyName}
			sections={navigation}
			activeId="eshop"
			actor={marek}
			actorRole="Operátor · online"
			actorPresence="online"
			commandLabel="Hľadať alebo vyvolať"
			createLabel="Vytvoriť"
			mobileContext={{
				label: "E-shop",
				icon: LayoutGridIcon,
				presence: [marek, lucia, autopilot],
			}}
			onNavigate={fn()}
			onOpenCommand={fn()}
			onCreate={fn()}
		>
			<ShellWorkspace />
		</CompanyShell>
	);
}

const meta = {
	title: "Templates/Shells/CompanyShell",
	component: CompanyShell,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		companyName: "Hrebeň",
		sections,
		activeId: "eshop",
		actor: marek,
		commandLabel: "Hľadať alebo vyvolať",
		children: <ShellWorkspace />,
	},
} satisfies Meta<typeof CompanyShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function expectNoPageOverflow(canvasElement: HTMLElement) {
	const documentElement = canvasElement.ownerDocument.documentElement;
	return expect(documentElement.scrollWidth).toBeLessThanOrEqual(documentElement.clientWidth);
}

export const Desktop1024: Story = {
	render: () => <HrebenShell />,
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const rail = canvasElement.querySelector('[data-slot="sidebar"]');
		const topbar = canvasElement.querySelector('[data-slot="space-context"]');
		const topbarTitle = topbar?.querySelector("h1");
		const activeSpace = canvasElement.querySelector(
			'[data-kind="space"][data-active] > span:not([data-slot])',
		);
		if (!(rail instanceof HTMLElement) || !(topbar instanceof HTMLElement)) {
			throw new Error("Chýba kanonický rail alebo kontextová lišta");
		}
		if (!(topbarTitle instanceof HTMLElement) || !(activeSpace instanceof HTMLElement)) {
			throw new Error("Chýba názov topbaru alebo aktívneho Priestoru");
		}
		await expect(rail.getBoundingClientRect().width).toBe(236);
		await expect(topbar.getBoundingClientRect().height).toBe(61);
		await expect(getComputedStyle(topbarTitle).fontSize).toBe("18px");
		await expect(getComputedStyle(topbarTitle).lineHeight).toBe("18px");
		await expect(getComputedStyle(topbarTitle).fontWeight).toBe("600");
		await expect(getComputedStyle(activeSpace).fontSize).toBe("15px");
		await expect(getComputedStyle(activeSpace).fontWeight).toBe("500");
		await expectNoPageOverflow(canvasElement);
	},
};

export const Wide1440: Story = {
	render: () => <HrebenShell />,
	globals: { viewport: { value: "wide1440", isRotated: false } },
	play: async ({ canvasElement }) => {
		shellTaskAction.mockClear();
		await userEvent.click(within(canvasElement).getByRole("button", { name: "sleduj" }));
		await expect(shellTaskAction).toHaveBeenCalledWith({
			kind: "open-run",
			runId: "run-landing-07",
		});
		await expectNoPageOverflow(canvasElement);
	},
};

export const Mobile390: Story = {
	render: () => <HrebenShell />,
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const navigation = canvas.getByRole("navigation", { name: "Hlavná mobilná navigácia" });
		const header = canvasElement.querySelector('[data-slot="mobile-place-header"]');
		const create = canvas.getByRole("button", { name: "Vytvoriť" });
		if (!(header instanceof HTMLElement)) throw new Error("Chýba mobilná hlavička miesta");

		const navigationActions = within(navigation).getAllByRole("button");
		await expect(navigationActions).toHaveLength(5);
		for (const action of navigationActions) {
			await expect(action).toHaveAttribute("data-slot", "button");
			await expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
			const actionRect = action.getBoundingClientRect();
			const hitTarget = canvasElement.ownerDocument.elementFromPoint(
				actionRect.left + actionRect.width / 2,
				actionRect.top + actionRect.height / 2,
			);
			await expect(hitTarget ? action.contains(hitTarget) : false).toBe(true);
			if (action.hasAttribute("data-part") && action.dataset.part === "mobile-nav-item") {
				await expect(getComputedStyle(action).flexDirection).toBe("column");
			}
			const label = action.querySelector('[data-part="mobile-nav-label"]');
			if (label instanceof HTMLElement) {
				const labelRect = label.getBoundingClientRect();
				await expect(labelRect.left).toBeGreaterThanOrEqual(actionRect.left);
				await expect(labelRect.right).toBeLessThanOrEqual(actionRect.right);
				await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
			}
		}
		await expect(header.getBoundingClientRect().height).toBe(52);
		await expect(create.getBoundingClientRect().width).toBe(54);
		await expect(create.getBoundingClientRect().height).toBe(54);
		await expect(getComputedStyle(navigation).paddingBottom).toBe("24px");
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowOverlayBoundary767: Story = {
	render: () => <HrebenShell />,
	globals: { pointer: "coarse", viewport: { value: "overlay767", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const AtOverlayBoundary768: Story = {
	render: () => <HrebenShell />,
	globals: { viewport: { value: "overlay768", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowShellBoundary1023: Story = {
	render: () => <HrebenShell />,
	globals: { viewport: { value: "shell1023", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const MobileNavigationDrawer: Story = {
	render: () => <HrebenShell />,
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", { name: "Otvoriť navigáciu" });
		await userEvent.click(trigger);
		const drawer = document.body.querySelector('[data-slot="drawer-popup"]');
		await waitFor(() => expect(drawer).toBeVisible());
		if (!(drawer instanceof HTMLElement)) throw new Error("Chýba ľavý navigačný Drawer");
		await expect(drawer.getBoundingClientRect().width).toBeLessThanOrEqual(300);
		await waitFor(() =>
			expect(Math.abs(drawer.getBoundingClientRect().left)).toBeLessThanOrEqual(0.5),
		);
	},
};

export const Dark: Story = {
	render: () => <HrebenShell />,
	globals: { theme: "dark", viewport: { value: "wide1440", isRotated: false } },
};

export const ReducedMotion: Story = {
	render: () => <HrebenShell />,
	globals: { motion: "reduce", viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.ownerDocument.documentElement.dataset.reducedMotion).toBe("reduce");
		await expectNoPageOverflow(canvasElement);
	},
};

export const LongCopyReference: Story = {
	render: () => (
		<HrebenShell
			companyName="Hrebeň — horské vybavenie a starostlivosť o zákazníkov"
			navigation={longCopySections}
		/>
	),
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				"letná-kampaň-pre-uvedenie-novej-kolekcie-na-celom-Slovensku",
			),
		).toBeVisible();
		await expectNoPageOverflow(canvasElement);
	},
};
