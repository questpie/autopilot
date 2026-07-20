import { useState } from "react";

import { AuthShell, Field, FieldLabel, Input, StateBand } from "@questpie/ui";

import { authClient } from "@/lib/auth-client";
import type { InvitationChallengeState } from "@/lib/data/invitation-continuation";

type SignInScreenProps = {
	/** Sanitized internal path to continue to after authentication. */
	redirectTo: string;
	/** Masked invitation continuation, when arriving via ?continue=invitation. */
	continuation?: InvitationChallengeState | null;
};

/** Renders the masked continuation context so the invited visitor knows what awaits. */
function InvitationContinuationNotice({
	continuation,
}: {
	continuation: InvitationChallengeState;
}) {
	if (continuation.status === "invalid") return null;
	const companyName = "companyName" in continuation ? continuation.companyName : "";
	const maskedEmail = "maskedEmail" in continuation ? continuation.maskedEmail : "";
	const message =
		continuation.status === "eligible"
			? `Pozvánka do spoločnosti ${companyName} čaká na adresu ${maskedEmail}. Prihláste sa alebo si vytvorte účet s touto adresou.`
			: continuation.status === "already-used"
				? `Pozvánka do spoločnosti ${companyName} už bola použitá.`
				: continuation.status === "expired"
					? `Platnosť pozvánky do spoločnosti ${companyName} vypršala.`
					: `Pozvánka do spoločnosti ${companyName} bola zrušená.`;
	return (
		<div
			data-testid="invitation-continuation"
			className="grid gap-1 rounded-md border border-hairline p-3 text-sm"
		>
			<p className="font-medium">Pokračujete v pozvánke</p>
			<p className="text-muted-foreground">{message}</p>
		</div>
	);
}

type Mode = "sign-in" | "sign-up";

const COPY = {
	"sign-in": {
		title: "Prihláste sa",
		primary: "Prihlásiť sa",
		primaryPending: "Prihlasujeme…",
		secondary: "Vytvoriť nový účet",
		error: "Prihlásenie zlyhalo. Skontrolujte e-mail a heslo.",
	},
	"sign-up": {
		title: "Vytvorte si účet",
		primary: "Vytvoriť účet",
		primaryPending: "Vytvárame účet…",
		secondary: "Máte účet? Prihláste sa",
		error: "Registrácia zlyhala. Skúste to znova alebo sa prihláste.",
	},
} as const;

export function SignInScreen({ redirectTo, continuation }: SignInScreenProps) {
	const [mode, setMode] = useState<Mode>("sign-in");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [inlineError, setInlineError] = useState<string | null>(null);
	const [verificationPendingFor, setVerificationPendingFor] = useState<string | null>(null);

	const toggleMode = () => {
		setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
		setInlineError(null);
	};

	const submit = async () => {
		if (pending) return;
		setPending(true);
		setInlineError(null);
		if (mode === "sign-in") {
			const { error } = await authClient.signIn.email({ email, password });
			if (!error) {
				// Document navigation lets SSR re-derive the session truth for every
				// guard; pending stays on until unload, so a second submit is impossible.
				window.location.assign(redirectTo);
				return;
			}
			// requireEmailVerification answers 403 before verification.
			if (error.status === 403) {
				setVerificationPendingFor(email);
			} else {
				setInlineError(COPY["sign-in"].error);
			}
			setPending(false);
			return;
		}
		const { error } = await authClient.signUp.email({ name, email, password });
		if (!error) {
			// Sign-up grants no session while the address is unverified.
			setVerificationPendingFor(email);
		} else {
			setInlineError(COPY["sign-up"].error);
		}
		setPending(false);
	};

	if (verificationPendingFor) {
		// Honest state: requireEmailVerification is on, but no verification
		// sender is wired anywhere yet — never claim an e-mail was sent.
		return (
			<div data-testid="screen-sign-in">
				<AuthShell
					title="Overte svoj e-mail"
					description={`Účet ${verificationPendingFor} čaká na overenie e-mailovej adresy. Po overení sa budete môcť prihlásiť.`}
					secondaryAction={{
						label: "Späť na prihlásenie",
						onSelect: () => {
							setVerificationPendingFor(null);
							setMode("sign-in");
						},
					}}
				>
					<p className="text-sm text-muted-foreground">
						Overovacie e-maily zatiaľ neodosielame automaticky — overenie adresy vybavuje správca
						prostredia.
					</p>
				</AuthShell>
			</div>
		);
	}

	const copy = COPY[mode];
	return (
		<div data-testid="screen-sign-in">
			<AuthShell
				title={copy.title}
				description="Pokračujte do svojej spoločnosti v QUESTPIE Autopilot."
				notice={
					continuation ? <InvitationContinuationNotice continuation={continuation} /> : undefined
				}
				stateBand={inlineError ? <StateBand tone="danger" label={inlineError} /> : undefined}
				primaryAction={{ label: copy.primary, pendingLabel: copy.primaryPending, pending }}
				secondaryAction={{ label: copy.secondary, disabled: pending, onSelect: toggleMode }}
				onSubmit={() => {
					void submit();
				}}
			>
				{mode === "sign-up" ? (
					<Field>
						<FieldLabel htmlFor="sign-in-name">Meno</FieldLabel>
						<Input
							id="sign-in-name"
							autoComplete="name"
							required
							value={name}
							disabled={pending}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
				) : null}
				<Field>
					<FieldLabel htmlFor="sign-in-email">E-mail</FieldLabel>
					<Input
						id="sign-in-email"
						type="email"
						autoComplete="email"
						required
						value={email}
						disabled={pending}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="sign-in-password">Heslo</FieldLabel>
					<Input
						id="sign-in-password"
						type="password"
						autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
						required
						minLength={8}
						value={password}
						disabled={pending}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
			</AuthShell>
		</div>
	);
}
