import { useEffect, useState } from "react";

import {
	ActorMark,
	AdaptiveConfirm,
	AuthShell,
	Button,
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
	Input,
	ListRow,
	Status,
} from "@questpie/ui";

import {
	type InvitationDraft,
	type InvitationIssueOutcome,
	type InvitationResendOutcome,
	type InvitationRevokeOutcome,
	isValidInviteEmail,
} from "@/lib/data/commands/invitations";
import type {
	TeamRoster,
	TeamRosterInvitation,
	TeamRosterMember,
} from "@/lib/data/feature-queries";

import { ONBOARDING_TOTAL_STEPS } from "@/components/screens/onboarding-steps";

/** The one-time delivery link held only in the issuing session's memory. */
type IssuedLink = { email: string; href: string | null };

/**
 * The revoke confirmation mounts client-side only. Its overlay (AdaptiveConfirm
 * -> Drawer/AlertDialog) is not server-renderable, so SSR streams a plain
 * trigger and the interactive dialog upgrades after hydration — the first
 * client render matches SSR, so there is no hydration mismatch.
 */
function useHydrated(): boolean {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	return hydrated;
}

function TeamMemberRow({ member }: { member: TeamRosterMember }) {
	return (
		<ListRow
			leading={
				<ActorMark actor={{ id: member.id, name: member.name, kind: member.kind }} size="sm" />
			}
			identity={member.name}
			meta={member.roleLabel ?? (member.kind === "agent" ? "Agent" : "Člen tímu")}
			trailing={
				member.pendingSetup ? <Status state="attention" label="Vyžaduje nastavenie" /> : null
			}
		/>
	);
}

function InvitationRow({
	invitation,
	busy,
	onResend,
	onRevoke,
}: {
	invitation: TeamRosterInvitation;
	busy: boolean;
	onResend: () => void;
	onRevoke: () => void;
}) {
	const hydrated = useHydrated();
	return (
		<ListRow
			identity={invitation.email}
			meta={`Pozvánka čaká · platí do ${invitation.expiresAt.slice(0, 10)}`}
			trailing={
				<>
					<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onResend}>
						Poslať znova
					</Button>
					{hydrated ? (
						<AdaptiveConfirm
							trigger={
								<Button type="button" variant="ghost" size="sm" disabled={busy}>
									Odvolať
								</Button>
							}
							title="Odvolať pozvánku?"
							description={`Pozvánka pre ${invitation.email} prestane platiť a jej odkaz sa už nedá použiť.`}
							confirmLabel="Odvolať pozvánku"
							destructive
							onConfirm={onRevoke}
						/>
					) : (
						<Button type="button" variant="ghost" size="sm" disabled>
							Odvolať
						</Button>
					)}
				</>
			}
		/>
	);
}

/**
 * The delivery link exists only in this session's memory: the server stores a
 * hash. Without email delivery the copyable link is the only honest channel,
 * so it is shown once, right after issue/resend.
 */
function DeliveryLinkNotice({ issued }: { issued: IssuedLink }) {
	if (!issued.href) {
		return (
			<p className="rounded-md border border-border-subtle p-3 text-sm text-muted-foreground">
				{`Pozvánka pre ${issued.email} už existuje, ale jej odkaz sa nedá znova zobraziť. Použite „Poslať znova“ a odovzdajte nový odkaz.`}
			</p>
		);
	}
	return (
		<section
			aria-label="Odkaz pozvánky"
			className="grid gap-2 rounded-md border border-border-subtle p-3"
		>
			<p className="text-sm font-medium">{`Pozvánka pre ${issued.email} je pripravená`}</p>
			<p className="text-sm text-muted-foreground">
				Pozvánky sa zatiaľ neodosielajú e-mailom. Skopírujte odkaz a doručte ho pozvanej osobe —
				zobrazuje sa iba teraz.
			</p>
			<Input
				readOnly
				value={issued.href}
				data-testid="invitation-delivery-link"
				aria-label="Odkaz pozvánky na skopírovanie"
				onFocus={(event) => event.currentTarget.select()}
			/>
		</section>
	);
}

export type TeamOnboardingStepProps = {
	roster: TeamRoster;
	onIssue: (draft: InvitationDraft) => Promise<InvitationIssueOutcome>;
	onResend: (invitation: TeamRosterInvitation) => Promise<InvitationResendOutcome>;
	onRevoke: (invitation: TeamRosterInvitation) => Promise<InvitationRevokeOutcome>;
	onContinue: () => void;
};

/**
 * Team step: server-truth roster (owner + dormant Autopilot + pending
 * invitations) with issue/resend/revoke wired to the real command seams.
 * Nothing here fakes agent activity — the agent renders as pending setup.
 */
export function TeamOnboardingStep({
	roster,
	onIssue,
	onResend,
	onRevoke,
	onContinue,
}: TeamOnboardingStepProps) {
	const [email, setEmail] = useState("");
	const [emailError, setEmailError] = useState<string | null>(null);
	const [inlineError, setInlineError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [issuedLink, setIssuedLink] = useState<IssuedLink | null>(null);

	const submitInvite = async () => {
		if (busy) return;
		// Per-address validation before any command leaves the screen.
		if (!isValidInviteEmail(email)) {
			setEmailError("Zadajte platnú e-mailovú adresu.");
			return;
		}
		setBusy(true);
		setEmailError(null);
		setInlineError(null);
		const outcome = await onIssue({ email });
		if (outcome.status === "recoverable") {
			// SPEC 10.3: the address stays intact; only the error band appears.
			setInlineError(outcome.message);
			setBusy(false);
			return;
		}
		setIssuedLink({ email: email.trim(), href: outcome.inviteHref });
		setEmail("");
		setBusy(false);
	};

	const resend = async (invitation: TeamRosterInvitation) => {
		if (busy) return;
		setBusy(true);
		setInlineError(null);
		const outcome = await onResend(invitation);
		if (outcome.status === "recoverable") setInlineError(outcome.message);
		else setIssuedLink({ email: invitation.email, href: outcome.inviteHref });
		setBusy(false);
	};

	const revoke = async (invitation: TeamRosterInvitation) => {
		if (busy) return;
		setBusy(true);
		setInlineError(null);
		const outcome = await onRevoke(invitation);
		if (outcome.status === "recoverable") setInlineError(outcome.message);
		else if (issuedLink?.email === invitation.email) setIssuedLink(null);
		setBusy(false);
	};

	return (
		<div data-testid="screen-team-setup">
			<AuthShell
				title="Pozvite svoj tím"
				description="Toto je váš tím dnes. Pozvánky doručíte odkazom — e-maily sa zatiaľ neodosielajú."
				step={{ current: 2, total: ONBOARDING_TOTAL_STEPS }}
				error={inlineError ?? undefined}
				primaryAction={{ label: "Pokračovať" }}
				onSubmit={onContinue}
			>
				<section aria-label="Členovia tímu" className="grid gap-1">
					<h2 className="text-sm font-medium">Členovia tímu</h2>
					{roster.members.map((member) => (
						<TeamMemberRow key={member.id} member={member} />
					))}
				</section>
				<section aria-label="Pozvánky" className="grid gap-1">
					<h2 className="text-sm font-medium">Pozvánky</h2>
					{roster.invitations.length === 0 ? (
						<p className="text-sm text-muted-foreground">Zatiaľ žiadne pozvánky.</p>
					) : (
						roster.invitations.map((invitation) => (
							<InvitationRow
								key={invitation.id}
								invitation={invitation}
								busy={busy}
								onResend={() => {
									void resend(invitation);
								}}
								onRevoke={() => {
									void revoke(invitation);
								}}
							/>
						))
					)}
				</section>
				{issuedLink ? <DeliveryLinkNotice issued={issuedLink} /> : null}
				<Field data-invalid={emailError ? true : undefined}>
					<FieldLabel htmlFor="invite-email">Pozvať kolegu</FieldLabel>
					<div className="flex gap-2">
						<Input
							id="invite-email"
							type="email"
							placeholder="lucia@firma.sk"
							value={email}
							disabled={busy}
							aria-invalid={emailError ? true : undefined}
							onChange={(event) => setEmail(event.target.value)}
						/>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => {
								void submitInvite();
							}}
						>
							Pozvať
						</Button>
					</div>
					{emailError ? (
						<FieldError>{emailError}</FieldError>
					) : (
						<FieldDescription>
							Pozvaná osoba dostane rolu člena spoločnosti. Odkaz na prijatie skopírujete po
							vytvorení pozvánky.
						</FieldDescription>
					)}
				</Field>
			</AuthShell>
		</div>
	);
}
