import type { ReactNode } from "react";

import { Button } from "@questpie/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@questpie/ui/components/ui/card";
import { Spinner } from "@questpie/ui/components/ui/spinner";

function InvitationTitle({ children }: { children: ReactNode }) {
	return (
		<h1
			data-slot="invitation-panel-title"
			className="font-heading text-lg leading-snug font-semibold"
		>
			{children}
		</h1>
	);
}

/** SPEC 10.0 invitation-acceptance states. Presentational only — the data layer decides which. */
export type InvitationPanelStatus =
	| "eligible"
	| "expired"
	| "revoked"
	| "already-used"
	| "wrong-account"
	| "query-error"
	| "mutation-error";

export interface InvitationPanelAction {
	label: string;
	/** Shown next to the spinner while pending; falls back to label. */
	pendingLabel?: string;
	pending?: boolean;
	disabled?: boolean;
	onSelect?: () => void;
}

export interface InvitationPanelProps {
	status: InvitationPanelStatus;
	companyName?: string;
	/** Already masked upstream (e.g. l•••a@firma.sk); the panel never receives the raw address. */
	maskedEmail?: string;
	roleLabel?: string;
	/** Danger copy rendered on mutation-error / wrong-account. */
	errorMessage?: string;
	/** Primary accept (eligible + mutation-error retry). */
	acceptAction?: InvitationPanelAction;
	/** "Toto nie som ja" — offered on eligible and wrong-account. */
	switchAccountAction?: InvitationPanelAction;
	/** Reload the invitation after a query failure. */
	retryAction?: InvitationPanelAction;
}

const TERMINAL_COPY: Record<
	"expired" | "revoked" | "already-used" | "query-error",
	{ title: string; body: string }
> = {
	expired: {
		title: "Platnosť pozvánky vypršala",
		body: "Táto pozvánka už neplatí. Požiadajte odosielateľa o novú.",
	},
	revoked: {
		title: "Pozvánka bola zrušená",
		body: "Túto pozvánku zrušil správca spoločnosti.",
	},
	"already-used": {
		title: "Pozvánka už bola použitá",
		body: "Táto pozvánka už bola prijatá. Prihláste sa do svojej spoločnosti.",
	},
	"query-error": {
		title: "Pozvánku sa nepodarilo načítať",
		body: "Pozvánku sa teraz nepodarilo overiť. Skúste to znova.",
	},
};

function ActionButton({
	action,
	type = "button",
	variant,
}: {
	action: InvitationPanelAction;
	type?: "button" | "submit";
	variant?: "ghost" | "outline";
}) {
	return (
		<Button
			type={type}
			variant={variant}
			data-pending={action.pending || undefined}
			disabled={action.pending || action.disabled}
			onClick={type === "submit" ? undefined : action.onSelect}
		>
			{action.pending ? <Spinner data-icon="inline-start" /> : null}
			{action.pending ? (action.pendingLabel ?? action.label) : action.label}
		</Button>
	);
}

function InvitationFrame({
	status,
	children,
	onSubmit,
	submitting,
}: {
	status: InvitationPanelStatus;
	children: ReactNode;
	onSubmit?: () => void;
	submitting?: boolean;
}) {
	return (
		<div
			data-slot="invitation-panel"
			data-status={status}
			className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-8"
		>
			<form
				data-slot="invitation-panel-frame"
				className="w-full max-w-md"
				onSubmit={(event) => {
					event.preventDefault();
					// Single-submit guard: a pending accept ignores repeated submits.
					if (submitting) return;
					onSubmit?.();
				}}
			>
				<Card>{children}</Card>
			</form>
		</div>
	);
}

function InvitationPanel(props: InvitationPanelProps) {
	const { status, companyName, maskedEmail, roleLabel, errorMessage } = props;

	if (status === "eligible" || status === "mutation-error") {
		const accept = props.acceptAction;
		return (
			<InvitationFrame status={status} onSubmit={accept?.onSelect} submitting={accept?.pending}>
				<CardHeader>
					<InvitationTitle>{`Pozvánka do spoločnosti ${companyName ?? ""}`.trim()}</InvitationTitle>
				</CardHeader>
				<CardContent className="grid gap-2">
					{status === "mutation-error" ? (
						<p data-slot="invitation-panel-error" className="text-sm font-medium text-foreground">
							{errorMessage ?? "Pozvánku sa nepodarilo prijať. Skúste to znova."}
						</p>
					) : null}
					{maskedEmail ? (
						<p className="text-sm">
							Pozvánka čaká na adresu <strong>{maskedEmail}</strong>.
						</p>
					) : null}
					{roleLabel ? (
						<p className="text-sm text-muted-foreground">{`Rola: ${roleLabel}`}</p>
					) : null}
				</CardContent>
				<CardFooter className="justify-end gap-3">
					{props.switchAccountAction ? (
						<ActionButton action={props.switchAccountAction} variant="ghost" />
					) : null}
					{accept ? <ActionButton action={accept} type="submit" /> : null}
				</CardFooter>
			</InvitationFrame>
		);
	}

	if (status === "wrong-account") {
		return (
			<InvitationFrame status={status}>
				<CardHeader>
					<InvitationTitle>Nesprávny účet</InvitationTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						{`Prihlásený účet sa nezhoduje s pozvánkou${
							maskedEmail ? ` pre ${maskedEmail}` : ""
						}. Prihláste sa správnou e-mailovou adresou.`}
					</p>
				</CardContent>
				{props.switchAccountAction ? (
					<CardFooter className="justify-end">
						<ActionButton action={props.switchAccountAction} variant="outline" />
					</CardFooter>
				) : null}
			</InvitationFrame>
		);
	}

	const copy = TERMINAL_COPY[status];
	const tail = status === "query-error" ? props.retryAction : props.switchAccountAction;
	return (
		<InvitationFrame status={status}>
			<CardHeader>
				<InvitationTitle>{copy.title}</InvitationTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground">{copy.body}</p>
			</CardContent>
			{tail ? (
				<CardFooter className="justify-end">
					<ActionButton action={tail} variant="outline" />
				</CardFooter>
			) : null}
		</InvitationFrame>
	);
}

export { InvitationPanel };
