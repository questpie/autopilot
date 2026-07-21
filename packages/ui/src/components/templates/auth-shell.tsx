import type { ReactNode } from "react";

import { BrandMark } from "@questpie/ui/components/composites/brand-mark";
import { Button } from "@questpie/ui/components/ui/button";
import { Card, CardFooter } from "@questpie/ui/components/ui/card";
import { Spinner } from "@questpie/ui/components/ui/spinner";

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
	/** Inline error band slot; pass a StateBand. */
	stateBand?: ReactNode;
	/** Invitation-continuation notice slot rendered between the heading and the content. */
	notice?: ReactNode;
	children: ReactNode;
	primaryAction?: AuthShellPrimaryAction;
	secondaryAction?: AuthShellSecondaryAction;
	onSubmit?: () => void;
}

function AuthShell({
	brand = "QUESTPIE",
	title,
	description,
	step,
	stateBand,
	notice,
	children,
	primaryAction,
	secondaryAction,
	onSubmit,
}: AuthShellProps) {
	return (
		<div
			data-slot="auth-shell"
			className="flex min-h-dvh w-full items-center justify-center bg-canvas px-4 py-8"
		>
			<form
				data-slot="auth-shell-frame"
				className="w-full max-w-md"
				onSubmit={(event) => {
					event.preventDefault();
					// Single-submit guard: while the primary action is pending the
					// form ignores repeated submits (Enter key included).
					if (primaryAction?.pending) return;
					onSubmit?.();
				}}
			>
				<Card className="gap-0 py-0">
					<header
						data-slot="auth-shell-brand"
						className="flex min-h-12 items-center gap-2 border-b border-hairline px-4"
					>
						<BrandMark size={20} />
						<span className="text-[0.8125rem] font-semibold tracking-[0.08em]">{brand}</span>
						{step ? (
							<span data-slot="auth-shell-step" className="ui-type-meta ml-auto tabular-nums">
								{`Krok ${step.current} z ${step.total}`}
							</span>
						) : null}
					</header>
					{stateBand ? <div data-slot="auth-shell-state">{stateBand}</div> : null}
					<div data-slot="auth-shell-body" className="grid gap-4 p-4 sm:p-5">
						<hgroup className="grid gap-1">
							<h1 className="font-heading text-lg leading-snug font-semibold">{title}</h1>
							{description ? (
								<p className="text-sm text-pretty text-muted-foreground">{description}</p>
							) : null}
						</hgroup>
						{notice ? <div data-slot="auth-shell-notice">{notice}</div> : null}
						<div data-slot="auth-shell-content" className="grid gap-4">
							{children}
						</div>
					</div>
					{primaryAction || secondaryAction ? (
						<CardFooter className="justify-end gap-3">
							{secondaryAction ? (
								<Button
									type="button"
									variant="ghost"
									disabled={secondaryAction.disabled}
									onClick={secondaryAction.onSelect}
								>
									{secondaryAction.label}
								</Button>
							) : null}
							{primaryAction ? (
								<Button
									type="submit"
									data-pending={primaryAction.pending || undefined}
									disabled={primaryAction.pending || primaryAction.disabled}
								>
									{primaryAction.pending ? <Spinner data-icon="inline-start" /> : null}
									{primaryAction.pending
										? (primaryAction.pendingLabel ?? primaryAction.label)
										: primaryAction.label}
								</Button>
							) : null}
						</CardFooter>
					) : null}
				</Card>
			</form>
		</div>
	);
}

export { AuthShell };
