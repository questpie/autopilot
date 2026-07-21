import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { TaskList, type TaskListProjection } from "../../components/templates";
import { hrebenReconnectingProjection, hrebenTaskListFixture } from "../../fixtures/hreben-work";

const meta = {
	title: "Templates/Task list",
	component: TaskList,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: { projection: hrebenTaskListFixture, onAction: fn() },
} satisfies Meta<typeof TaskList>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectNoPageOverflow(canvasElement: HTMLElement) {
	const documentElement = canvasElement.ownerDocument.documentElement;
	await expect(documentElement.scrollWidth).toBeLessThanOrEqual(documentElement.clientWidth);

	const viewportWidth = documentElement.clientWidth;
	const overflow = [...canvasElement.querySelectorAll<HTMLElement>("*")]
		.filter((element) => {
			if (element.closest('[data-slot="space-facet-nav"], [data-slot="work-board"]')) {
				return false;
			}
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return (
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				rect.width > 1 &&
				(rect.left < -0.5 || rect.right > viewportWidth + 0.5)
			);
		})
		.map((element) => ({
			slot: element.dataset.slot ?? element.className,
			rect: element.getBoundingClientRect().toJSON(),
		}));

	await expect(overflow).toEqual([]);
}

function withListResult(
	list: TaskListProjection<"space-e-shop">["display"]["list"],
): TaskListProjection<"space-e-shop"> {
	const { selection: _selection, ...withoutSelection } = hrebenTaskListFixture;
	return list.kind === "ready"
		? { ...hrebenTaskListFixture, display: { active: "list", list } }
		: ({
				...withoutSelection,
				display: { active: "list", list },
			} as TaskListProjection<"space-e-shop">);
}

export const TasksPopulated: Story = {
	globals: { viewport: { value: "wide1440", isRotated: false } },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const context = canvasElement.querySelector<HTMLElement>('[data-slot="space-context"]');
		const facets = canvasElement.querySelector<HTMLElement>('[data-slot="space-facet-nav"]');
		const viewbar = canvasElement.querySelector<HTMLElement>('[data-slot="object-view-bar"]');
		const selection = canvasElement.querySelector<HTMLElement>('[data-slot="work-selection-bar"]');
		const groups = canvasElement.querySelectorAll('[data-slot="state-group"]');
		const rows = canvasElement.querySelectorAll('[data-slot="work-object-row"]');
		const firstRow = canvasElement.querySelector<HTMLElement>('[data-object-id="landing"]');
		const firstTag = firstRow?.querySelector<HTMLElement>('[data-slot="technical-tag"]');
		if (!(context && facets && viewbar && selection && firstRow && firstTag)) {
			throw new Error("Chýba kanonická pracovná anatómia");
		}
		await expect(context.getBoundingClientRect().height).toBe(61);
		await expect(facets.getBoundingClientRect().height).toBe(42);
		await expect(viewbar.getBoundingClientRect().height).toBe(63);
		await expect(selection.getBoundingClientRect().height).toBe(44);
		await expect(groups).toHaveLength(5);
		await expect(rows).toHaveLength(8);
		await expect(canvasElement.querySelectorAll('[data-selected="true"]')).toHaveLength(3);
		await expect(canvasElement.querySelectorAll('[data-part="object-create-action"]')).toHaveLength(
			1,
		);
		await expect(canvas.getByRole("button", { name: "Nová úloha" })).toHaveAttribute(
			"data-variant",
			"default",
		);
		await expect(canvas.getByText(/Rýchlo pridať úlohu/)).toBeVisible();
		await expect(canvas.getByText("214")).toBeVisible();
		await expect(firstRow.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
		await expect(firstTag).toHaveAttribute("data-project-space-id", "space-e-shop");
		await expect(firstRow.querySelector('[data-run-id="run-landing-07"]')).toBeInTheDocument();
		await expect(firstRow.querySelector('[data-thread-id="thread-landing"]')).toBeInTheDocument();
		await expect(
			canvasElement.querySelector('[data-effect-id="effect-newsletter-draft-11"]'),
		).toBeInTheDocument();
		await userEvent.click(canvas.getAllByRole("button", { name: "sleduj" })[0]!);
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "open-run",
			runId: "run-landing-07",
		});
		await userEvent.click(canvas.getByRole("button", { name: "Načítať ďalšie" }));
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "load-next-page",
			cursor: "task:spring",
		});
		await expectNoPageOverflow(canvasElement);
	},
};

export const BoardAvailable: Story = {
	args: {
		projection: {
			...hrebenTaskListFixture,
			display: { ...hrebenTaskListFixture.display, active: "board" },
		},
	},
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('[data-slot="work-board"]')).toBeVisible();
		await expect(canvasElement.querySelectorAll('[data-slot="work-board-column"]')).toHaveLength(5);
		await expectNoPageOverflow(canvasElement);
	},
};

export const BoardUnavailable: Story = {
	args: {
		projection: {
			...hrebenTaskListFixture,
			display: { active: "list", list: hrebenTaskListFixture.display.list },
		},
	},
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).queryByRole("group", { name: "Zobrazenie" })).toBeNull();
	},
};

export const RealtimeReconciledMove: Story = {
	args: {
		projection: {
			...hrebenTaskListFixture,
			sync: {
				kind: "reconciled",
				lastEventId: "event-43",
				movedTaskIds: ["newsletter"],
			},
			display: {
				...hrebenTaskListFixture.display,
				list: {
					...hrebenTaskListFixture.display.list,
					groups: hrebenTaskListFixture.display.list.groups.map((group) =>
						group.id === "running"
							? { ...group, count: 3, taskIds: [...group.taskIds, "newsletter"] }
							: group.id === "review"
								? { ...group, count: 1, taskIds: group.taskIds.filter((id) => id !== "newsletter") }
								: group,
					),
				},
			},
		},
	},
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector<HTMLElement>('[data-object-id="newsletter"]');
		await expect(row).toHaveAttribute("data-selected", "true");
		await expect(row).toHaveAttribute("data-object-version", "11");
		await expect(row?.closest('[data-group-id="running"]')).not.toBeNull();
	},
};

export const PaginationError: Story = {
	args: {
		projection: {
			...hrebenTaskListFixture,
			display: {
				...hrebenTaskListFixture.display,
				list: {
					...hrebenTaskListFixture.display.list,
					page: {
						loadedCount: 8,
						totalCount: 222,
						next: {
							kind: "error",
							cursor: "task:spring",
							label: "Načítanie zlyhalo",
							retryLabel: "Skúsiť načítať znova",
						},
					},
				},
			},
		},
	},
	play: async ({ canvasElement, args }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Skúsiť načítať znova" }),
		);
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "retry-next-page",
			cursor: "task:spring",
		});
	},
};

export const Reconnecting: Story = { args: { projection: hrebenReconnectingProjection } };

export const Loading: Story = {
	args: { projection: withListResult({ kind: "loading", label: "Načítavam úlohy" }) },
};

export const Empty: Story = {
	args: {
		projection: withListResult({
			kind: "empty",
			title: "Zatiaľ žiadne úlohy",
			description: "Vytvorte prvú úlohu alebo ju nechajte navrhnúť Autopilotom.",
		}),
	},
};

export const NoResults: Story = {
	args: {
		projection: withListResult({
			kind: "no-results",
			title: "Nenašli sme žiadne úlohy",
			description: "Skúste upraviť hľadanie alebo zrušiť aktívne filtre.",
		}),
	},
};

export const LoadError: Story = {
	args: {
		projection: withListResult({
			kind: "error",
			title: "Úlohy sa nepodarilo načítať",
			description: "Pripojenie zlyhalo. Skúste to znova o chvíľu.",
			retryLabel: "Skúsiť znova",
		}),
	},
};

export const AccessDenied: Story = {
	args: {
		projection: withListResult({
			kind: "access",
			title: "Nemáte prístup",
			description: "Požiadajte vlastníka priestoru o oprávnenie na zobrazenie úloh.",
		}),
	},
};

export const ReadOnly: Story = {
	args: {
		projection: {
			...hrebenTaskListFixture,
			access: { kind: "read-only", canCreate: false, canSelect: false, canMutate: false },
			selection: undefined,
			display: {
				...hrebenTaskListFixture.display,
				list: {
					...hrebenTaskListFixture.display.list,
					tasks: Object.fromEntries(
						Object.entries(hrebenTaskListFixture.display.list.tasks).map(([id, task]) => [
							id,
							{ ...task, allowedActions: ["open"] },
						]),
					),
				},
			},
		} as TaskListProjection<"space-e-shop">,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByRole("button", { name: "Nová úloha" })).toBeNull();
		await expect(canvasElement.querySelector('[data-slot="work-selection-bar"]')).toBeNull();
		await expect(canvasElement.querySelector('[data-slot="checkbox"]')).toBeNull();
		await expect(canvas.queryByRole("button", { name: "Vrátiť späť" })).toBeNull();
	},
};

export const Mobile390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Comfortable 44px tier: the icon tool button, the row open target, quick-add.
		const comfortTargets = [
			canvas.getByRole("button", { name: "Nástroje úloh" }),
			canvas.getAllByRole("button", { name: /Otvoriť úlohu:/ })[0]!,
			canvas.getByRole("button", { name: /Rýchlo pridať úlohu/ }),
		];
		for (const control of comfortTargets) {
			await expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
			await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
		// Secondary `.btn--sm` affordances (selection overflow, load-more) settle on the
		// 36px small touch tier per the ratified size scale — still wide, easy to hit.
		const compactTargets = [
			canvas.getByRole("button", { name: "Akcie výberu" }),
			canvas.getByRole("button", { name: "Načítať ďalšie" }),
		];
		for (const control of compactTargets) {
			await expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
			await expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
		}
		await expect(canvas.queryByRole("group", { name: "Uložené pohľady" })).toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Nástroje úloh" }));
		const menu = within(canvasElement.ownerDocument.body);
		for (const item of [
			"Potrebuje ťa",
			"Beží",
			"Tím",
			"Naplánované",
			"Po termíne",
			"Zoznam",
			"Tabuľa",
			"Nová úloha",
		]) {
			const menuItem = menu.getByRole("menuitem", { name: item });
			await expect(menuItem).toBeVisible();
			await expect(menuItem.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowOverlayBoundary767: Story = {
	globals: { pointer: "coarse", viewport: { value: "overlay767", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const AtOverlayBoundary768: Story = {
	globals: { pointer: "coarse", viewport: { value: "overlay768", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const selection = canvasElement.querySelector<HTMLElement>('[data-slot="work-selection-bar"]');
		const agentActivity = canvasElement.querySelector<HTMLElement>(
			'.work-agent-activity[data-run-id="run-landing-07"]',
		);
		if (!selection) throw new Error("Chýba výberový režim");
		if (!agentActivity) throw new Error("Chýba živá aktivita Agenta");
		await expect(selection.scrollHeight).toBeLessThanOrEqual(selection.clientHeight);
		await expect(canvas.getByRole("button", { name: "Akcie výberu" })).toBeVisible();
		await expect(agentActivity).toHaveTextContent("Autopilot · píše…");
		await expect(agentActivity).toHaveTextContent("0:41");
		const follow = canvas.getAllByRole("button", { name: "sleduj" })[0]!;
		await expect(follow).toBeVisible();
		await expect(follow.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		await expect(agentActivity.getBoundingClientRect().right).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientWidth,
		);
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowShellBoundary1023: Story = {
	globals: { viewport: { value: "shell1023", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const AtShellBoundary1024: Story = {
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const Dark: Story = {
	globals: { theme: "dark", viewport: { value: "wide1440", isRotated: false } },
};
