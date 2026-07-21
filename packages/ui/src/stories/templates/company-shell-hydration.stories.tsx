import type { Meta, StoryObj } from "@storybook/react-vite";
import { HouseIcon, InboxIcon, LayoutGridIcon, UsersIcon } from "lucide-react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CompanyShell, type CompanyNavigationSection } from "../../components/templates";

const marek = { id: "marek", name: "Marek H.", kind: "human" as const };
const COMPANY_NAME = "Hrebeň";

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
				mobileSlot: "inbox",
			},
		],
	},
	{
		id: "spaces",
		label: "Priestory",
		items: [
			{ kind: "space", id: "whole", label: "Whole Company" },
			{
				kind: "space",
				id: "spaces",
				label: "Všetky priestory",
				icon: LayoutGridIcon,
				mobileSlot: "spaces",
			},
		],
	},
	{
		id: "resources",
		items: [
			{ kind: "resource", id: "team", label: "Tím", icon: UsersIcon },
			{ kind: "direct", id: "self", label: "Ja", actor: marek, mobileSlot: "self" },
		],
	},
] satisfies readonly CompanyNavigationSection[];

function ShellUnderTest() {
	return (
		<CompanyShell
			companyName={COMPANY_NAME}
			sections={sections}
			activeId="home"
			actor={marek}
			commandLabel="Hľadať alebo vyvolať"
			createLabel="Vytvoriť"
			onCreate={() => undefined}
			onNavigate={() => undefined}
		>
			<div data-testid="shell-child">Domov</div>
		</CompanyShell>
	);
}

const meta = {
	title: "Templates/Company shell (SSR hydration)",
	component: CompanyShell,
	parameters: { layout: "fullscreen" },
	args: {
		companyName: COMPANY_NAME,
		sections,
		activeId: "home",
		actor: marek,
		commandLabel: "Hľadať alebo vyvolať",
		children: <div>Domov</div>,
	},
} satisfies Meta<typeof CompanyShell>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The exact SSR crash the fix removes: null server dispatcher on the popup store. */
const POPUP_STORE_CRASH = /ReactSharedInternals|useSyncExternalStore/;

const collect = (args: unknown[]): string =>
	args
		.map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack ?? ""}` : String(arg)))
		.join(" ");

/**
 * Proves the base-ui-popup fix beyond the F01 SSR-substring gate (review Q5): the
 * kit shell server-renders with its Drawer mount-gated out, hydrates cleanly, and
 * the mobile navigation Drawer opens post-hydration — no `ReactSharedInternals.H` /
 * useSyncExternalStore crash, and the drawer content appears.
 */
export const SsrThenHydrateOpensDrawer: Story = {
	render: () => <div data-testid="ssr-hydration-host" />,
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async () => {
		const errors: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(collect(args));
			originalError(...args);
		};

		const host = document.createElement("div");
		document.body.append(host);
		let root: Root | undefined;
		try {
			const tree = <ShellUnderTest />;

			// SSR must not crash at the popup store: the Drawer is gated out server-side.
			const html = renderToString(tree);
			expect(html).toContain('data-slot="company-shell"');
			expect(html).toContain("Domov");
			expect(html).not.toContain('data-slot="drawer-popup"');
			host.innerHTML = html;

			// The first client render matches SSR (Drawer still gated) — hydration is clean.
			root = hydrateRoot(host, tree);
			await new Promise((resolve) => setTimeout(resolve, 0));

			// After hydration the base-ui Drawer.Root mounts client-side; open it.
			const trigger = await waitFor(() =>
				within(host).getByRole("button", { name: "Otvoriť navigáciu" }),
			);
			await userEvent.click(trigger);

			const drawer = await waitFor(() => {
				const popup = document.body.querySelector('[data-slot="drawer-popup"]');
				expect(popup).not.toBeNull();
				return popup as HTMLElement;
			});
			await waitFor(() => expect(drawer).toBeVisible());
			expect(drawer.textContent ?? "").toContain(COMPANY_NAME);

			expect(errors.filter((message) => POPUP_STORE_CRASH.test(message))).toEqual([]);
			expect(errors.filter((message) => /Hydration failed/i.test(message))).toEqual([]);
		} finally {
			root?.unmount();
			host.remove();
			console.error = originalError;
		}
	},
};
