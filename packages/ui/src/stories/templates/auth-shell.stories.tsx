import type { Meta, StoryObj } from "@storybook/react-vite";
import { LockIcon, MailIcon } from "lucide-react";
import { expect, fireEvent, fn, userEvent, within } from "storybook/test";

import { StateBand } from "../../components/composites";
import { AuthShell } from "../../components/templates";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Field,
	FieldDescription,
	FieldLabel,
	IconInput,
	Input,
} from "../../components/ui";

function SignInFields({
	email = "",
	disabled = false,
}: {
	email?: string;
	disabled?: boolean;
} = {}) {
	return (
		<>
			<Field>
				<FieldLabel htmlFor="sign-in-email">E-mail</FieldLabel>
				<IconInput
					id="sign-in-email"
					type="email"
					autoComplete="email"
					placeholder="marek@hreben.sk"
					icon={<MailIcon />}
					defaultValue={email}
					disabled={disabled}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="sign-in-password">Heslo</FieldLabel>
				<IconInput
					id="sign-in-password"
					type="password"
					autoComplete="current-password"
					icon={<LockIcon />}
					disabled={disabled}
				/>
			</Field>
		</>
	);
}

function CompanyStepFields() {
	return (
		<>
			<Field>
				<FieldLabel htmlFor="company-name">Názov spoločnosti</FieldLabel>
				<Input id="company-name" defaultValue="Hrebeň" />
			</Field>
			<Field>
				<FieldLabel htmlFor="company-slug">Adresa spoločnosti</FieldLabel>
				<Input id="company-slug" defaultValue="hreben" />
				<FieldDescription>
					Vytvorí sa: priestor Celá firma, kanál #general, váš ľudský aktér a čakajúci Autopilot.
				</FieldDescription>
			</Field>
		</>
	);
}

const meta = {
	title: "Templates/Auth shell",
	component: AuthShell,
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
	args: {
		title: "Prihláste sa",
		description: "Pokračujte do svojej spoločnosti jedným účtom.",
		children: <SignInFields />,
		primaryAction: { label: "Prihlásiť sa" },
		secondaryAction: { label: "Vytvoriť účet", onSelect: fn() },
		onSubmit: fn(),
	},
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function expectNoPageOverflow(canvasElement: HTMLElement) {
	const documentElement = canvasElement.ownerDocument.documentElement;
	return expect(documentElement.scrollWidth).toBeLessThanOrEqual(documentElement.clientWidth);
}

export const Desktop1024: Story = {
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const frame = canvasElement.querySelector('[data-slot="auth-shell-frame"]');
		const shell = canvasElement.querySelector('[data-slot="auth-shell"]');
		if (!(frame instanceof HTMLElement) || !(shell instanceof HTMLElement)) {
			throw new Error("Chýba vycentrovaný rám vstupnej obrazovky");
		}
		const frameRect = frame.getBoundingClientRect();
		const shellRect = shell.getBoundingClientRect();
		await expect(frameRect.width).toBeLessThanOrEqual(448);
		const leftGap = frameRect.left - shellRect.left;
		const rightGap = shellRect.right - frameRect.right;
		await expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
		await expect(
			within(canvasElement).getByRole("heading", { level: 1, name: "Prihláste sa" }),
		).toBeVisible();
		await expectNoPageOverflow(canvasElement);
	},
};

export const Wide1440: Story = {
	globals: { viewport: { value: "wide1440", isRotated: false } },
	play: async ({ args, canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "Prihlásiť sa" }));
		await expect(args.onSubmit).toHaveBeenCalledTimes(1);
		await expectNoPageOverflow(canvasElement);
	},
};

export const Mobile390: Story = {
	globals: { pointer: "coarse", viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const email = canvas.getByLabelText("E-mail");
		const submit = canvas.getByRole("button", { name: "Prihlásiť sa" });
		await expect(getComputedStyle(email).fontSize).toBe("16px");
		await expect(email.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		await expect(submit.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
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

export const OnboardingStep: Story = {
	args: {
		title: "Vytvorte svoju spoločnosť",
		description: "Názov vidí celý tím; adresa sa používa v odkazoch.",
		step: { current: 1, total: 4 },
		children: <CompanyStepFields />,
		primaryAction: { label: "Pokračovať" },
		secondaryAction: undefined,
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const stepMeta = canvasElement.querySelector('[data-slot="auth-shell-step"]');
		if (!(stepMeta instanceof HTMLElement)) throw new Error("Chýba dátové počítadlo krokov");
		await expect(stepMeta).toHaveTextContent("Krok 1 z 4");
		await expectNoPageOverflow(canvasElement);
	},
};

export const LongCopy: Story = {
	args: {
		title: "Prihláste sa do spoločnosti Hrebeň — horské vybavenie a starostlivosť o zákazníkov",
		description:
			"Pokračujte tam, kde ste prestali: rozpracované nastavenie spoločnosti, pozvánky pre tím aj" +
			" pripojenie Autopilota na vás počkajú presne v takom stave, v akom ste ich nechali.",
		step: { current: 2, total: 4 },
		children: (
			<SignInFields email="marek.hrasko+letna-kampan-pre-uvedenie-novej-kolekcie@hreben.sk" />
		),
	},
	globals: { viewport: { value: "mobile390", isRotated: false } },
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByRole("heading", { level: 1 })).toBeVisible();
		await expectNoPageOverflow(canvasElement);
	},
};

export const CredentialPending: Story = {
	args: {
		children: <SignInFields email="marek@hreben.sk" disabled />,
		primaryAction: { label: "Prihlásiť sa", pendingLabel: "Prihlasujem sa", pending: true },
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const submit = canvas.getByRole("button", { name: "Prihlasujem sa" });
		await expect(submit).toBeDisabled();
		await expect(submit).toHaveAttribute("data-pending");
		const spinner = submit.querySelector('[data-slot="spinner"]');
		await expect(spinner).not.toBeNull();
		const form = canvasElement.querySelector('[data-slot="auth-shell-frame"]');
		if (!(form instanceof HTMLFormElement)) throw new Error("Chýba formulár vstupného rámu");
		await fireEvent.submit(form);
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

export const InlineError: Story = {
	args: {
		error: "Nesprávny e-mail alebo heslo. Skúste to znova.",
		children: <SignInFields email="marek@hreben.sk" />,
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const error = canvasElement.querySelector('[data-slot="auth-shell-error"]');
		if (!(error instanceof HTMLElement)) throw new Error("Chýba riadok chyby prihlásenia");
		await expect(error).toHaveAttribute("role", "status");
		await expect(error).toHaveTextContent("Nesprávny e-mail alebo heslo");
		await expect(within(canvasElement).getByLabelText("E-mail")).toHaveValue("marek@hreben.sk");
	},
};

export const OfflineBanner: Story = {
	args: {
		stateBand: (
			<StateBand
				tone="attention"
				label="Offline — nedá sa spojiť s prihlásením"
				meta="obnovujem…"
			/>
		),
		primaryAction: { label: "Prihlásiť sa", disabled: true },
		children: <SignInFields email="marek@hreben.sk" />,
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const band = canvasElement.querySelector('[data-slot="state-band"]');
		if (!(band instanceof HTMLElement)) throw new Error("Chýba pás stavu pripojenia");
		await expect(band).toHaveAttribute("data-tone", "attention");
	},
};

export const InvitationContinuation: Story = {
	args: {
		notice: (
			<Alert>
				<AlertTitle>Pokračujete v pozvánke</AlertTitle>
				<AlertDescription>
					Pozvánka do spoločnosti Hrebeň čaká na adresu l•••a@hreben.sk. Prihláste sa alebo si
					vytvorte účet s touto adresou.
				</AlertDescription>
			</Alert>
		),
		children: <SignInFields email="lucia@hreben.sk" />,
	},
	globals: { viewport: { value: "shell1024", isRotated: false } },
	play: async ({ canvasElement }) => {
		const notice = canvasElement.querySelector('[data-slot="auth-shell-notice"]');
		if (!(notice instanceof HTMLElement)) throw new Error("Chýba oznam o pokračovaní pozvánky");
		await expect(within(notice).getByText("Pokračujete v pozvánke")).toBeVisible();
	},
};
