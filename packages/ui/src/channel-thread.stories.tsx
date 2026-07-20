import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { ChannelThread, type ChannelThreadProjection } from "./components/ai";

const marek = { id: "marek", name: "Marek Drepovský", kind: "human" as const };
const lucia = { id: "lucia", name: "Lucia", kind: "human" as const };
const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };
const run = {
	id: "run-01",
	actor: autopilot,
	state: {
		kind: "live" as const,
		phase: "working" as const,
		phaseLabel: "Pracuje",
		currentAction: "Pripravuje návrh ponuky",
	},
	elapsed: "2 min",
	activity: "Použil 4 nástroje · naposledy prehľadal Znalosti",
	hiddenActivityCount: 5,
};

const messages = [
	{
		id: "m1",
		actor: marek,
		presence: "online" as const,
		authoredAt: { iso: "2026-07-19T09:41:00+02:00", label: "09:41" },
		parts: [
			{
				id: "m1-copy",
				kind: "markdown" as const,
				markdown:
					'<mention actor_id="autopilot" node_id="mention-m1-autopilot">@Autopilot</mention> priprav **návrh ponuky** podľa aktuálnych kritérií.',
			},
		],
	},
	{
		id: "m2",
		actor: autopilot,
		presence: "online" as const,
		authoredAt: { iso: "2026-07-19T09:42:00+02:00", label: "09:42" },
		parts: [
			{
				id: "m2-copy",
				kind: "markdown" as const,
				markdown: "Najprv porovnám kritériá s poslednou schválenou ponukou.",
			},
			{ id: "m2-run", kind: "run" as const, run },
		],
	},
];

const composer = {
	mode: "channel" as const,
	draft: { text: "", clientNonce: "draft-01", mentions: [], attachments: [] },
	state: "ready" as const,
	mentionPicker: {
		label: "Spomenúť aktéra",
		actors: [autopilot, lucia],
		state: "ready" as const,
	},
};

const readyProjection = {
	title: "# general",
	vessel: { kind: "channel" as const, channelId: "general", spaceId: "company-root" },
	content: {
		kind: "ready",
		messages,
		history: { remaining: 40, state: "ready", label: "Načítať staršie" },
	},
	composer,
} satisfies ChannelThreadProjection;

const meta = {
	title: "Templates/Collaboration/ChannelThread",
	component: ChannelThread,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		projection: readyProjection,
		onAction: fn(),
	},
} satisfies Meta<typeof ChannelThread>;

export default meta;
type Story = StoryObj<typeof meta>;

function expectNoPageOverflow(canvasElement: HTMLElement) {
	const root = canvasElement.ownerDocument.documentElement;
	return expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

export const Conversation: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Marek Drepovský")).toBeInTheDocument();
		await expect(canvas.getAllByText("Autopilot").length).toBeGreaterThan(0);
		await expect(canvas.getByText("návrh ponuky").closest("strong")).not.toBeNull();
		await expect(
			canvas.getByText("@Autopilot").closest('[data-slot="actor-mention"]'),
		).toHaveAttribute("data-actor-id", "autopilot");
		await expect(canvasElement.querySelector('[data-slot="bubble"]')).toBeNull();
		await expect(canvasElement.querySelector('[data-slot="message-part-run"]')).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-slot="message-part-run"] [data-slot="actor-chip"]'),
		).toBeNull();
		await expect(
			Math.round(
				canvasElement
					.querySelector<HTMLElement>('[data-part="run-summary"]')!
					.getBoundingClientRect().height,
			),
		).toBe(144);
		await expect(
			canvasElement.querySelector('[data-slot="message-header"] [data-slot="actor-role"]'),
		).toBeNull();
		await expect(canvasElement.querySelectorAll('[data-slot="actor-presence"]')).toHaveLength(2);
		await expect(canvas.getByRole("button", { name: "Odoslať správu" })).toHaveAttribute(
			"data-variant",
			"secondary",
		);
		for (const message of canvasElement.querySelectorAll('[data-slot="message"]')) {
			await expect(message).toHaveAttribute("data-align", "start");
			await expect(getComputedStyle(message).columnGap).toBe("12px");
		}
		const nestedRun = canvasElement.querySelector<HTMLElement>('[data-part="run-summary"]');
		const composerControl = canvasElement.querySelector<HTMLElement>(
			'[data-slot="message-composer"] [data-slot="input-group"]',
		);
		await expect(nestedRun).not.toBeNull();
		await expect(nestedRun!.querySelector('[data-slot="actor-mark"]')).toBeNull();
		// A bounded run object is a raised WHITE object on the thread (board .run on
		// --color-surface); the earlier canvas-subtle rail tone inverted figure/ground.
		await expect(getComputedStyle(nestedRun!).backgroundColor).toBe("rgb(255, 255, 255)");
		await expect(composerControl).not.toBeNull();
		await expect(getComputedStyle(composerControl!).borderRadius).toBe("14px");
		await expect(getComputedStyle(composerControl!).backgroundColor).toBe("rgb(247, 243, 236)");
		const header = canvasElement.querySelector("header");
		if (!(header instanceof HTMLElement)) throw new Error("Chýba hlavička kanála");
		await expect(header.getBoundingClientRect().height).toBe(52);
		await expectNoPageOverflow(canvasElement);
	},
};

export const StructuredComposerIntent: Story = {
	args: {
		projection: {
			...readyProjection,
			composer: {
				...composer,
				draft: {
					text: "Skontrolujte priložený návrh",
					clientNonce: "draft-structured-01",
					mentions: [
						{
							nodeId: "mention-draft-autopilot",
							actorId: "autopilot",
							actorKind: "agent",
							label: "Autopilot",
						},
					],
					attachments: [
						{
							id: "attachment-draft-brief",
							kind: "knowledge",
							label: "Brief letnej kampane",
							sourceId: "knowledge-brief-01",
							scope: { companyId: "hreben", spaceId: "eshop" },
						},
					],
				},
			},
		},
	},
	play: async ({ canvasElement, args }) => {
		await expect(
			canvasElement.querySelector('[data-mention-node-id="mention-draft-autopilot"]'),
		).toHaveAttribute("data-actor-id", "autopilot");
		await expect(
			canvasElement.querySelector('[data-attachment-id="attachment-draft-brief"]'),
		).toHaveAttribute("data-source-id", "knowledge-brief-01");
		await userEvent.click(within(canvasElement).getByRole("button", { name: "Spomenúť aktéra" }));
		const picker = within(document.body);
		await waitFor(() => expect(picker.getByRole("menuitem", { name: /Lucia/ })).toBeVisible());
		await userEvent.click(picker.getByRole("menuitem", { name: /Lucia/ }));
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "composer-mention-select",
			actorId: "lucia",
		});
	},
};

export const HonestDeliveryPhases: Story = {
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "ready",
				messages: [
					{
						...messages[0]!,
						id: "message-sending",
						delivery: { kind: "sending", label: "Odosiela sa" },
					},
					{
						...messages[1]!,
						id: "message-failed",
						delivery: {
							kind: "failed",
							label: "Odoslanie zlyhalo",
							retryLabel: "Zopakovať odoslanie",
						},
					},
				],
			},
		},
	},
	play: async ({ canvasElement, args }) => {
		await expect(
			canvasElement.querySelector('[data-part="message-delivery"][data-delivery-state="sending"]'),
		).toHaveTextContent("Odosiela sa");
		const retry = within(canvasElement).getByRole("button", { name: "Zopakovať odoslanie" });
		await expect(retry.closest('[data-part="message-delivery"]')).not.toBeNull();
		await userEvent.click(retry);
		await expect(args.onAction).toHaveBeenCalledWith({
			kind: "retry-message",
			messageId: "message-failed",
		});
	},
};

export const AnchoredThread380: Story = {
	args: {
		projection: {
			...readyProjection,
			title: "Vlákno úlohy",
			vessel: {
				kind: "thread",
				threadId: "thread-task-01",
				anchor: { messageId: "m1", label: "Úloha · Pripraviť návrh ponuky" },
				participants: [
					{ actor: marek, presence: "online" },
					{ actor: autopilot, presence: "online" },
				],
				follow: { state: "following", label: "Sledujem" },
			},
		},
	},
	render: (args) => (
		<div className="grid min-h-[40rem] grid-cols-[minmax(0,1fr)_var(--detail-aside)] bg-canvas">
			<main aria-label="Obsah úlohy" className="min-w-0 bg-surface" />
			<aside data-part="anchored-thread-vessel" className="min-w-0 border-l border-hairline">
				<ChannelThread {...args} />
			</aside>
		</div>
	),
	play: async ({ canvasElement }) => {
		const vessel = canvasElement.querySelector<HTMLElement>('[data-part="anchored-thread-vessel"]');
		await expect(vessel).not.toBeNull();
		await expect(Math.round(vessel!.getBoundingClientRect().width)).toBe(380);
		await expectNoPageOverflow(canvasElement);
	},
};

export const Reconnecting: Story = {
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "reconnecting",
				messages,
				label: "Offline — obnovujeme spojenie",
				replayLabel: "načítavame zmeškané udalosti",
			},
			composer: {
				...composer,
				draft: { ...composer.draft, text: "Rozpísaná správa" },
				state: "reconnecting",
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("region", { name: "Správy" })).toBeInTheDocument();
		await expect(canvas.getByRole("button", { name: "Odoslať správu" })).toBeDisabled();
		await expect(canvas.getByText("Rozpísaná správa")).toBeVisible();
	},
};

export const ReplayGap: Story = {
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "replay-gap",
				messages,
				label: "História potrebuje obnovenie",
				description: "Kurzor je starší než dostupné okno replayu.",
				recoveryLabel: "Obnoviť bezpečne",
			},
		},
	},
};

export const Empty: Story = {
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "empty",
				title: "Zatiaľ ticho",
				description: "Napíšte prvú správu alebo @spomeňte Autopilota.",
			},
		},
	},
};

export const Loading: Story = {
	args: {
		projection: {
			...readyProjection,
			content: { kind: "loading", label: "Načítavame správy" },
			composer: undefined,
		},
	},
};

export const LoadError: Story = {
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "error",
				title: "Správy sa nepodarilo načítať",
				description: "Skontrolujte spojenie a skúste to znova.",
				retryLabel: "Skúsiť znova",
			},
			composer: undefined,
		},
	},
};

export const AccessRevoked: Story = {
	args: {
		projection: {
			title: "# financie",
			vessel: { kind: "channel", channelId: "finance", spaceId: "company-root" },
			content: {
				kind: "access-revoked",
				title: "Prístup bol odobratý",
				description: "Obsah kanála už nie je dostupný pre vášho Aktéra.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('[data-slot="message-composer"]')).toBeNull();
		await expect(canvasElement.querySelector('[data-slot="message"]')).toBeNull();
	},
};

export const Archived: Story = {
	args: {
		projection: {
			title: "# leto-2025",
			vessel: { kind: "channel", channelId: "summer-2025", spaceId: "company-root" },
			content: {
				kind: "archived",
				messages,
				notice: "Kanál je archivovaný a zostáva iba na čítanie.",
			},
		},
	},
	play: async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('[data-slot="message-composer"]')).toBeNull();
		await expect(
			within(canvasElement).getByText("Kanál je archivovaný a zostáva iba na čítanie."),
		).toBeVisible();
	},
};

export const KeyboardComposer: Story = {
	args: {
		projection: {
			...readyProjection,
			composer: { ...composer, draft: { ...composer.draft, text: "Prvý riadok" } },
		},
	},
	play: async ({ canvasElement, args }) => {
		const textarea = within(canvasElement).getByRole("textbox", { name: "Napíšte do kanála…" });
		await userEvent.click(textarea);
		await userEvent.keyboard("{Shift>}{Enter}{/Shift}Druhý riadok");
		await expect(args.onAction).toHaveBeenCalledWith(
			expect.objectContaining({ kind: "composer-draft-change" }),
		);
	},
};

export const Mobile390: Story = {
	globals: {
		pointer: "coarse",
		safeArea: "24",
		viewport: { value: "mobile390", isRotated: false },
	},
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
		// Board `.composer__send` is a neutral `.btn--sm`; the ratified coarse tier scale
		// lifts it to the 36px small touch tier (not the retired flat 44px floor).
		const send = within(canvasElement).getByRole("button", { name: "Odoslať správu" });
		await expect(send.getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
	},
};

export const BelowOverlayBoundary767: Story = {
	globals: { pointer: "coarse", viewport: { value: "overlay767", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const AtOverlayBoundary768: Story = {
	globals: { viewport: { value: "overlay768", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const BelowShellBoundary1023: Story = {
	globals: { viewport: { value: "shell1023", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const AtShellBoundary1024: Story = {
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const LongSlovakCopy390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	args: {
		projection: {
			...readyProjection,
			content: {
				kind: "ready",
				messages: messages.map((message) => ({
					...message,
					parts: [
						{
							id: `${message.id}-long`,
							kind: "markdown" as const,
							markdown:
								"Pripravujem dôsledne vysvetlený návrh kampane pre slovenských zákazníkov vrátane termínov, dôkazov a krokov schválenia bez skrátenia významu.",
						},
					],
				})),
			},
		},
	},
	play: async ({ canvasElement }) => expectNoPageOverflow(canvasElement),
};

export const ReducedMotion: Story = {
	globals: { motion: "reduce" },
	play: async ({ canvasElement }) => {
		await expect(canvasElement.ownerDocument.documentElement.dataset.reducedMotion).toBe("reduce");
	},
};

export const Dark: Story = {
	globals: { theme: "dark" },
};
