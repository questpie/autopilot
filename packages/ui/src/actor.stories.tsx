import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ActorIdentity, ActorMark, ActorStack } from "./components/composites";

const human = {
	id: "marek",
	name: "Marek Drepovský",
	kind: "human" as const,
};

const agent = {
	id: "autopilot",
	name: "Autopilot",
	kind: "agent" as const,
};

const meta = {
	title: "Identity & status/Actor identity",
	component: ActorIdentity,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
	args: { actor: human },
} satisfies Meta<typeof ActorIdentity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Human: Story = {
	args: { actor: human, presence: "online" },
};

export const Agent: Story = {
	args: { actor: agent, presence: "online" },
};

export const AvatarParity: Story = {
	render: () => (
		<div className="ui-story-grid">
			<ActorMark actor={human} presence="online" />
			<ActorMark actor={agent} presence="online" />
			<ActorMark actor={human} size="sm" presence="away" />
			<ActorMark actor={agent} size="sm" presence="away" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const humanMark = canvasElement.querySelector('[data-slot="actor-mark"][data-kind="human"]');
		const agentMark = canvasElement.querySelector('[data-slot="actor-mark"][data-kind="agent"]');
		if (!(humanMark instanceof HTMLElement) || !(agentMark instanceof HTMLElement)) {
			throw new Error("Chýba Human alebo Agent avatar");
		}
		const humanAvatar = humanMark.querySelector('[data-slot="avatar"]');
		const agentAvatar = agentMark.querySelector('[data-slot="avatar"]');
		const humanFallback = humanMark.querySelector('[data-slot="avatar-fallback"]');
		const agentFallback = agentMark.querySelector('[data-slot="avatar-fallback"]');
		if (
			!(humanAvatar instanceof HTMLElement) ||
			!(agentAvatar instanceof HTMLElement) ||
			!(humanFallback instanceof HTMLElement) ||
			!(agentFallback instanceof HTMLElement)
		) {
			throw new Error("Chýba povrch Human alebo Agent avataru");
		}

		await expect(agentMark.getBoundingClientRect().width).toBe(28);
		await expect(agentAvatar.getBoundingClientRect().width).toBe(
			humanAvatar.getBoundingClientRect().width,
		);
		await expect(Number.parseFloat(getComputedStyle(agentAvatar).borderRadius)).toBeLessThan(
			Number.parseFloat(getComputedStyle(humanAvatar).borderRadius),
		);
		await expect(getComputedStyle(agentFallback).backgroundColor).not.toBe(
			getComputedStyle(humanFallback).backgroundColor,
		);
		await expect(getComputedStyle(agentFallback).color).not.toBe(
			getComputedStyle(humanFallback).color,
		);
		for (const mark of canvasElement.querySelectorAll('[data-slot="actor-mark"]')) {
			const avatar = mark.querySelector('[data-slot="avatar"]');
			if (!(mark instanceof HTMLElement) || !(avatar instanceof HTMLElement)) {
				throw new Error("Chýba Actor mark alebo jeho Avatar");
			}
			await expect(avatar.getBoundingClientRect().width).toBe(mark.getBoundingClientRect().width);
			await expect(avatar.getBoundingClientRect().height).toBe(mark.getBoundingClientRect().height);
		}
	},
};

export const IdentityParity: Story = {
	render: () => (
		<div className="ui-story-stack">
			<ActorIdentity actor={human} presence="online" />
			<ActorIdentity actor={agent} presence="online" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const identities = canvasElement.querySelectorAll('[data-slot="actor-identity"]');
		await expect(identities).toHaveLength(2);
		for (const identity of identities) {
			await expect(getComputedStyle(identity).borderTopWidth).toBe("0px");
			await expect(getComputedStyle(identity).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		}
	},
};

export const PresenceStack: Story = {
	render: () => (
		<ActorStack
			size="sm"
			members={[
				{ actor: human, presence: "online" },
				{ actor: { ...human, id: "lucia", name: "Lucia Poláková" }, presence: "online" },
				{ actor: agent, presence: "online" },
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		const marks = Array.from(canvasElement.querySelectorAll('[data-slot="actor-mark"]'));
		await expect(marks).toHaveLength(3);
		const first = marks[0]?.getBoundingClientRect();
		const second = marks[1]?.getBoundingClientRect();
		if (!first || !second) throw new Error("Chýbajú aktéri v stacku");
		await expect(second.left - first.left).toBe(16);
	},
};

export const LongIdentity: Story = {
	args: {
		actor: {
			...human,
			name: "Marek Drepovský s veľmi dlhým pracovným označením",
		},
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
};
