import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";

import { InvitationPanel } from "../../components/templates";

const meta = {
	title: "Templates/Invitation panel",
	component: InvitationPanel,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		status: "eligible",
		companyName: "Hrebeň",
		maskedEmail: "l•••a@hreben.sk",
		roleLabel: "Člen spoločnosti",
		acceptAction: { label: "Prijať pozvánku", onSelect: fn() },
		switchAccountAction: { label: "Toto nie som ja", onSelect: fn() },
	},
} satisfies Meta<typeof InvitationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function expectNoPageOverflow(canvasElement: HTMLElement) {
	const documentElement = canvasElement.ownerDocument.documentElement;
	return expect(documentElement.scrollWidth).toBeLessThanOrEqual(documentElement.clientWidth);
}

export const Desktop1024: Story = {
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const frame = canvasElement.querySelector('[data-slot="invitation-panel-frame"]');
		const shell = canvasElement.querySelector('[data-slot="invitation-panel"]');
		if (!(frame instanceof HTMLElement) || !(shell instanceof HTMLElement)) {
			throw new Error("Chýba vycentrovaný rám pozvánky");
		}
		const frameRect = frame.getBoundingClientRect();
		const shellRect = shell.getBoundingClientRect();
		await expect(frameRect.width).toBeLessThanOrEqual(448);
		const leftGap = frameRect.left - shellRect.left;
		const rightGap = shellRect.right - frameRect.right;
		await expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
		await expect(
			within(canvasElement).getByRole("heading", { name: /Pozvánka do spoločnosti Hrebeň/ }),
		).toBeVisible();
		await expectNoPageOverflow(canvasElement);
	},
};

export const Wide1440: Story = {
	globals: { viewport: { value: "wide1440", isRotated: false } },
	play: async ({ args, canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "Prijať pozvánku" }));
		await expect(args.acceptAction?.onSelect).toHaveBeenCalledTimes(1);
		await expectNoPageOverflow(canvasElement);
	},
};

export const Mobile390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const accept = within(canvasElement).getByRole("button", { name: "Prijať pozvánku" });
		await expect(accept.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowOverlayBoundary767: Story = {
	globals: { pointer: "coarse", viewport: { value: "overlay767", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const AtOverlayBoundary768: Story = {
	globals: { viewport: { value: "overlay768", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const BelowShellBoundary1023: Story = {
	globals: { viewport: { value: "shell1023", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const Dark: Story = {
	globals: { theme: "dark", viewport: { value: "shell1024", isRotated: false } },
};

export const AcceptPending: Story = {
	args: {
		acceptAction: {
			label: "Prijať pozvánku",
			pendingLabel: "Prijímam…",
			pending: true,
			onSelect: fn(),
		},
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const submit = canvas.getByRole("button", { name: "Prijímam…" });
		await expect(submit).toBeDisabled();
		await expect(submit).toHaveAttribute("data-pending");
		await expect(submit.querySelector('[data-slot="spinner"]')).not.toBeNull();
		const form = canvasElement.querySelector('[data-slot="invitation-panel-frame"]');
		if (!(form instanceof HTMLFormElement)) throw new Error("Chýba formulár pozvánky");
		await fireEvent.submit(form);
		await expect(args.acceptAction?.onSelect).not.toHaveBeenCalled();
	},
};

export const WrongAccount: Story = {
	args: {
		status: "wrong-account",
		acceptAction: undefined,
		switchAccountAction: { label: "Prihlásiť sa iným účtom", onSelect: fn() },
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const panel = canvasElement.querySelector('[data-slot="invitation-panel"]');
		if (!(panel instanceof HTMLElement)) throw new Error("Chýba panel pozvánky");
		await expect(panel).toHaveAttribute("data-status", "wrong-account");
		await expect(
			within(canvasElement).getByRole("heading", { name: "Nesprávny účet" }),
		).toBeVisible();
	},
};

export const MutationError: Story = {
	args: {
		status: "mutation-error",
		errorMessage: "Pozvánku sa nepodarilo prijať. Skúste to znova.",
		acceptAction: { label: "Skúsiť znova", onSelect: fn() },
		switchAccountAction: undefined,
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const error = canvasElement.querySelector('[data-slot="invitation-panel-error"]');
		if (!(error instanceof HTMLElement)) throw new Error("Chýba chybové hlásenie pozvánky");
		await expect(error).toHaveTextContent("Skúste to znova");
	},
};

export const Expired: Story = {
	args: {
		status: "expired",
		acceptAction: undefined,
		switchAccountAction: { label: "Späť na prihlásenie", onSelect: fn() },
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("heading", { name: "Platnosť pozvánky vypršala" }),
		).toBeVisible();
	},
};

export const Revoked: Story = {
	args: {
		status: "revoked",
		acceptAction: undefined,
		switchAccountAction: { label: "Späť na prihlásenie", onSelect: fn() },
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
};

export const AlreadyUsed: Story = {
	args: {
		status: "already-used",
		acceptAction: undefined,
		switchAccountAction: { label: "Prejsť do spoločnosti", onSelect: fn() },
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expectNoPageOverflow(canvasElement);
	},
};

export const QueryError: Story = {
	args: {
		status: "query-error",
		acceptAction: undefined,
		switchAccountAction: undefined,
		retryAction: { label: "Skúsiť znova", onSelect: fn() },
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ args, canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "Skúsiť znova" }));
		await expect(args.retryAction?.onSelect).toHaveBeenCalledTimes(1);
	},
};

export const LongCopy: Story = {
	args: {
		companyName: "Hrebeň — horské vybavenie a starostlivosť o zákazníkov na celom Slovensku",
		maskedEmail: "l•••a@hreben-hory-a-vybavenie.sk",
		roleLabel: "Člen spoločnosti s prístupom do priestoru Celá firma",
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("heading", { level: 1 })).toBeVisible();
		await expectNoPageOverflow(canvasElement);
	},
};
