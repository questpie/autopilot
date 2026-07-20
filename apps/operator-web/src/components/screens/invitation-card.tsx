import { useState } from "react";

import { InvitationPanel, type InvitationPanelStatus } from "@questpie/ui";

import { authClient } from "@/lib/auth-client";
import type { InvitationAcceptOutcome } from "@/lib/data/commands/invitations";
import type { InvitationChallengeState } from "@/lib/data/invitation-continuation";

export type InvitationAcceptanceScreenProps = {
	challenge: InvitationChallengeState;
	onAccept: (expectedVersion: number) => Promise<InvitationAcceptOutcome>;
	onAccepted: () => void;
	onRetry: () => void;
};

/** "invalid" from the seam reads as a load failure the visitor can retry. */
const basePanelStatus = (challenge: InvitationChallengeState): InvitationPanelStatus =>
	challenge.status === "invalid" ? "query-error" : challenge.status;

/**
 * Invitation acceptance card (SPEC 10.0): renders the masked continuation state
 * and drives the accept command. A verified email mismatch surfaces the honest
 * wrong-account state; a failed accept becomes a retryable mutation error.
 */
export function InvitationAcceptanceScreen({
	challenge,
	onAccept,
	onAccepted,
	onRetry,
}: InvitationAcceptanceScreenProps) {
	const [pending, setPending] = useState(false);
	const [override, setOverride] = useState<InvitationPanelStatus | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const status = override ?? basePanelStatus(challenge);
	const companyName = "companyName" in challenge ? challenge.companyName : undefined;
	const maskedEmail = "maskedEmail" in challenge ? challenge.maskedEmail : undefined;
	const roleLabel = challenge.status === "eligible" ? challenge.roleLabel : undefined;

	const accept = async () => {
		if (challenge.status !== "eligible" || pending) return;
		setPending(true);
		setErrorMessage(null);
		const outcome = await onAccept(challenge.expectedVersion);
		if (outcome.status === "accepted") {
			onAccepted();
			return;
		}
		if (outcome.status === "wrong-account") {
			setOverride("wrong-account");
		} else {
			setOverride("mutation-error");
			setErrorMessage(outcome.message);
		}
		setPending(false);
	};

	const switchAccount = async () => {
		// Sign out but keep the continuation cookie; the sign-in banner re-reads it.
		await authClient.signOut().catch(() => undefined);
		window.location.assign("/sign-in?continue=invitation");
	};

	const acceptable = status === "eligible" || status === "mutation-error";
	const terminal = status === "already-used" || status === "expired" || status === "revoked";

	return (
		<div data-testid="screen-invitation-acceptance">
			<InvitationPanel
				status={status}
				companyName={companyName}
				maskedEmail={maskedEmail}
				roleLabel={roleLabel}
				errorMessage={errorMessage ?? undefined}
				acceptAction={
					acceptable
						? {
								label: "Prijať pozvánku",
								pendingLabel: "Prijímam…",
								pending,
								onSelect: () => {
									void accept();
								},
							}
						: undefined
				}
				switchAccountAction={
					acceptable
						? { label: "Toto nie som ja", disabled: pending, onSelect: () => void switchAccount() }
						: status === "wrong-account"
							? { label: "Prihlásiť sa iným účtom", onSelect: () => void switchAccount() }
							: terminal
								? { label: "Späť na prihlásenie", onSelect: () => void switchAccount() }
								: undefined
				}
				retryAction={
					status === "query-error" ? { label: "Skúsiť znova", onSelect: onRetry } : undefined
				}
			/>
		</div>
	);
}
