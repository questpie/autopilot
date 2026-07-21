import { useState } from "react";

import { AuthShell, Field, FieldLabel, IconInput, StateBand } from "@questpie/ui";

import { authClient } from "@/lib/auth-client";
import { LockGlyph, MailGlyph, UserGlyph } from "@/components/icons/field-glyphs";
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
			className="grid gap-1 rounded-[var(--radius-control)] border border-hairline bg-canvas-subtle p-3 text-sm"
		>
			<p className="font-medium">Pokračujete v pozvánke</p>
			<p className="text-pretty text-muted-foreground">{message}</p>
		</div>
	);
}

type ResendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Unverified-account state: the account exists but its address is not verified,
 * so Better Auth grants no session. A verification link is sent to the address
 * at sign-up (`emailVerification.sendOnSignUp`); this screen lets the visitor
 * request a fresh one via `sendVerificationEmail`. Whether that mail leaves over
 * console/SMTP/Plunk is an env-level adapter choice in `questpie.config.ts`, not
 * a concern this UI reflects.
 */
function VerifyEmailPending({
	email,
	redirectTo,
	onBack,
}: {
	email: string;
	redirectTo: string;
	onBack: () => void;
}) {
	const [status, setStatus] = useState<ResendStatus>("idle");

	const resend = async () => {
		if (status === "sending") return;
		setStatus("sending");
		try {
			const { error } = await authClient.sendVerificationEmail({
				email,
				// After clicking the link the visitor lands on their intended
				// destination; the SSR guard resolves the (now valid) session there.
				callbackURL: redirectTo,
			});
			setStatus(error ? "error" : "sent");
		} catch {
			// A thrown call (offline / fetch failure) must not wedge the button on
			// "sending" — fail closed to the retryable error state.
			setStatus("error");
		}
	};

	const stateBand =
		status === "sent" ? (
			<StateBand tone="live" label={`Overovací e-mail sme znova odoslali na ${email}.`} />
		) : status === "error" ? (
			<StateBand tone="danger" label="E-mail sa nepodarilo odoslať. Skúste to o chvíľu znova." />
		) : undefined;

	return (
		<div data-testid="screen-sign-in">
			<AuthShell
				title="Overte svoj e-mail"
				description={`Poslali sme overovací odkaz na ${email}. Otvorte ho a dokončite aktiváciu účtu.`}
				stateBand={stateBand}
				primaryAction={{
					label: "Poslať e-mail znova",
					pendingLabel: "Odosielame…",
					pending: status === "sending",
				}}
				secondaryAction={{
					label: "Späť na prihlásenie",
					disabled: status === "sending",
					onSelect: onBack,
				}}
				onSubmit={() => {
					void resend();
				}}
			>
				<p className="text-pretty text-sm text-muted-foreground">
					Skontrolujte si doručenú poštu aj priečinok so spamom. Ak odkaz nedorazil, pošlite si ho
					nanovo.
				</p>
			</AuthShell>
		</div>
	);
}

type Mode = "sign-in" | "sign-up";

const COPY = {
	"sign-in": {
		title: "Prihláste sa",
		description: "Pokračujte do svojho pracovného priestoru v QUESTPIE Autopilot.",
		primary: "Prihlásiť sa",
		primaryPending: "Prihlasujeme…",
		secondary: "Ešte nemáte účet? Vytvorte si ho",
		error: "Nesprávny e-mail alebo heslo. Skúste to znova.",
	},
	"sign-up": {
		title: "Vytvorte si účet",
		description: "Založte si účet a pripojte sa k svojmu tímu v QUESTPIE Autopilot.",
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
		try {
			if (mode === "sign-in") {
				const { error } = await authClient.signIn.email({ email, password });
				if (!error) {
					// Success: document navigation re-derives the session truth for every
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
			} else {
				const { error } = await authClient.signUp.email({ name, email, password });
				if (!error) {
					// Sign-up grants no session while the address is unverified.
					setVerificationPendingFor(email);
				} else {
					setInlineError(COPY["sign-up"].error);
				}
			}
		} catch {
			// A thrown auth call (offline / fetch failure) must not wedge the form
			// pending forever — surface the neutral message and release the button.
			setInlineError(COPY[mode].error);
		}
		// Every non-navigating outcome lands here; the success path returned above
		// with pending intentionally left on until the document unloads.
		setPending(false);
	};

	if (verificationPendingFor) {
		return (
			<VerifyEmailPending
				email={verificationPendingFor}
				redirectTo={redirectTo}
				onBack={() => {
					setVerificationPendingFor(null);
					setMode("sign-in");
				}}
			/>
		);
	}

	const copy = COPY[mode];
	return (
		<div data-testid="screen-sign-in">
			<AuthShell
				title={copy.title}
				description={copy.description}
				notice={
					continuation ? <InvitationContinuationNotice continuation={continuation} /> : undefined
				}
				error={inlineError ?? undefined}
				primaryAction={{ label: copy.primary, pendingLabel: copy.primaryPending, pending }}
				secondaryAction={{ label: copy.secondary, disabled: pending, onSelect: toggleMode }}
				onSubmit={() => {
					void submit();
				}}
			>
				{mode === "sign-up" ? (
					<Field>
						<FieldLabel htmlFor="sign-in-name">Meno</FieldLabel>
						<IconInput
							id="sign-in-name"
							autoComplete="name"
							required
							placeholder="Ako vás má tím oslovovať"
							icon={<UserGlyph />}
							value={name}
							disabled={pending}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
				) : null}
				<Field>
					<FieldLabel htmlFor="sign-in-email">E-mail</FieldLabel>
					<IconInput
						id="sign-in-email"
						type="email"
						autoComplete="email"
						required
						placeholder="vy@firma.sk"
						icon={<MailGlyph />}
						value={email}
						disabled={pending}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="sign-in-password">Heslo</FieldLabel>
					<IconInput
						id="sign-in-password"
						type="password"
						autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
						required
						minLength={8}
						placeholder={mode === "sign-in" ? "Zadajte heslo" : "Aspoň 8 znakov"}
						icon={<LockGlyph />}
						value={password}
						disabled={pending}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</Field>
			</AuthShell>
		</div>
	);
}
