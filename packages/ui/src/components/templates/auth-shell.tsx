import type { ReactNode } from "react";

import { BrandMark } from "@questpie/ui/components/composites/brand-mark";
import { Button } from "@questpie/ui/components/ui/button";
import { Card } from "@questpie/ui/components/ui/card";
import { Spinner } from "@questpie/ui/components/ui/spinner";
import { cn } from "@questpie/ui/lib/utils";

export interface AuthShellStep {
	current: number;
	total: number;
}

export interface AuthShellPrimaryAction {
	label: string;
	/** Shown next to the spinner while pending; falls back to label. */
	pendingLabel?: string;
	pending?: boolean;
	disabled?: boolean;
}

export interface AuthShellSecondaryAction {
	label: string;
	disabled?: boolean;
	onSelect?: () => void;
}

export interface AuthShellProps {
	brand?: string;
	title: string;
	description?: ReactNode;
	/** Data-driven step meta rendered as "Krok X z Y"; total comes from the flow, never hardcoded. */
	step?: AuthShellStep;
	/** Top banner slot (offline / success re-auth). Pass a StateBand — it sits flush at the card top. */
	stateBand?: ReactNode;
	/** Invitation-continuation notice slot rendered between the heading and the fields. */
	notice?: ReactNode;
	children: ReactNode;
	/**
	 * Inline rejection line rendered directly under the fields. Reads warm
	 * attention-gold (never loud red), states ONE neutral message, and never
	 * echoes which field or the entered secret — the auth "error" contract.
	 */
	error?: ReactNode;
	primaryAction?: AuthShellPrimaryAction;
	secondaryAction?: AuthShellSecondaryAction;
	onSubmit?: () => void;
}

/**
 * The canonical unauthenticated surface: one centered ~416px card on the paper
 * canvas. A single layout instantiates every entry variant (sign-in, invited
 * member, first-admin bootstrap, session-expired, and the human onboarding
 * steps) — the screen fills the slots. The card carries NO coral of its own
 * except the ONE full-width primary CTA (the sole action coral); the brand pip
 * is logo identity, statuses stay warm-muted. Credentials are the user's own —
 * this frame renders none back, so nothing typed is ever echoed here.
 */
function AuthShell({
	brand = "QUESTPIE",
	title,
	description,
	step,
	stateBand,
	notice,
	children,
	error,
	primaryAction,
	secondaryAction,
	onSubmit,
}: AuthShellProps) {
	return (
		<div
			data-slot="auth-shell"
			className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-8"
		>
			<form
				data-slot="auth-shell-frame"
				className="w-full max-w-[26rem]"
				onSubmit={(event) => {
					event.preventDefault();
					// Single-submit guard: while the primary action is pending the
					// form ignores repeated submits (Enter key included).
					if (primaryAction?.pending) return;
					onSubmit?.();
				}}
			>
				<Card className="gap-0 overflow-hidden py-0">
					{stateBand ? <div data-slot="auth-shell-state">{stateBand}</div> : null}
					<div data-slot="auth-shell-body" className="grid gap-5 p-6 sm:p-7">
						<div data-slot="auth-shell-brand" className="flex items-center justify-center gap-2">
							<BrandMark size={22} />
							<span className="text-[0.8125rem] font-semibold tracking-[0.08em]">{brand}</span>
						</div>
						<hgroup className="grid gap-1.5 text-center">
							{step ? (
								<span data-slot="auth-shell-step" className="ui-type-meta text-muted-foreground">
									{`Krok ${step.current} z ${step.total}`}
								</span>
							) : null}
							<h1 className="font-heading text-xl leading-snug font-semibold">{title}</h1>
							{description ? (
								<p className="text-sm text-pretty text-muted-foreground">{description}</p>
							) : null}
						</hgroup>
						{notice ? <div data-slot="auth-shell-notice">{notice}</div> : null}
						<div data-slot="auth-shell-content" className="grid gap-4">
							{children}
							{/* Persistent live region: it stays mounted (visually hidden while
							    empty) so a screen reader reliably announces a rejection the moment
							    the copy appears, instead of racing a conditional mount. */}
							<p
								data-slot="auth-shell-error"
								role="status"
								aria-live="polite"
								className={cn("flex items-start gap-2 text-sm", !error && "sr-only")}
							>
								{error ? (
									<>
										<span
											className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-warning"
											aria-hidden
										/>
										<span className="text-pretty text-muted-foreground">{error}</span>
									</>
								) : null}
							</p>
						</div>
						{primaryAction ? (
							<Button
								type="submit"
								className="w-full"
								data-pending={primaryAction.pending || undefined}
								disabled={primaryAction.pending || primaryAction.disabled}
							>
								{primaryAction.pending ? <Spinner data-icon="inline-start" /> : null}
								{primaryAction.pending
									? (primaryAction.pendingLabel ?? primaryAction.label)
									: primaryAction.label}
							</Button>
						) : null}
						{secondaryAction ? (
							<div className="text-center">
								<Button
									type="button"
									variant="ghost"
									size="default"
									disabled={secondaryAction.disabled}
									onClick={secondaryAction.onSelect}
								>
									{secondaryAction.label}
								</Button>
							</div>
						) : null}
					</div>
				</Card>
			</form>
		</div>
	);
}

export { AuthShell };
