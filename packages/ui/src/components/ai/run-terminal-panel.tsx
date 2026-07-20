import { CircleXIcon, RotateCcwIcon, UnplugIcon } from "lucide-react";

import type { RunPresentationState } from "@questpie/ui/components/ai/run-state";
import { RunRecap } from "@questpie/ui/components/ai/run-recap";
import { Button } from "@questpie/ui/components/ui/button";

function RunTerminalPanel({
	state,
	onRetry,
	onOpenRecord,
}: {
	state: RunPresentationState;
	onRetry: () => void;
	onOpenRecord: (recordId: string) => void;
}) {
	switch (state.kind) {
		case "completed":
			return <RunRecap recap={state.recap} onOpenRecord={onOpenRecord} />;
		case "failed":
			return (
				<section data-slot="run-failure" className="flex items-start gap-3 p-4">
					<CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
					<div className="min-w-0 flex-1">
						<h3 className="font-medium">Beh zlyhal</h3>
						<p className="mt-1 text-muted-foreground">{state.summary}</p>
					</div>
					<Button variant="secondary" size="sm" onClick={onRetry}>
						<RotateCcwIcon data-icon="inline-start" aria-hidden />
						{state.retryLabel}
					</Button>
				</section>
			);
		case "reconnecting":
			return (
				<section data-slot="run-reconnecting" className="flex items-start gap-3 p-4">
					<UnplugIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
					<div>
						<h3 className="font-medium">{state.label}</h3>
						<p className="mt-1 text-muted-foreground">{state.replayLabel}</p>
					</div>
				</section>
			);
		case "cancel-requested":
			return (
				<section data-slot="run-cancel-requested" className="p-4">
					<h3 className="font-medium">{state.label}</h3>
					<p className="mt-1 text-muted-foreground">
						{state.requestedBy.name} · {state.requestedAt}
					</p>
				</section>
			);
		case "rejected":
			return (
				<section data-slot="run-rejected" className="p-4">
					<h3 className="font-medium">Beh bol odmietnutý</h3>
					<p className="mt-1 text-muted-foreground">
						{state.reason} · {state.occurredAt}
					</p>
				</section>
			);
		case "timed-out":
			return (
				<section data-slot="run-timed-out" className="flex items-start gap-3 p-4">
					<CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
					<div className="min-w-0 flex-1">
						<h3 className="font-medium">Čas behu vypršal</h3>
						<p className="mt-1 text-muted-foreground">{state.summary}</p>
					</div>
					<Button variant="secondary" size="sm" onClick={onRetry}>
						<RotateCcwIcon data-icon="inline-start" aria-hidden />
						{state.retryLabel}
					</Button>
				</section>
			);
		case "cancelled":
			return (
				<section data-slot="run-cancelled" className="p-4">
					<h3 className="font-medium">Beh bol zrušený</h3>
					<p className="mt-1 text-muted-foreground">
						{state.reason} · {state.cancelledBy.name} · {state.cancelledAt}
					</p>
				</section>
			);
		case "waiting-permission":
			return (
				<p className="p-4 text-muted-foreground">Beh čaká na rozhodnutie v záložke Oprávnenia.</p>
			);
		case "live":
			return <p className="p-4 text-muted-foreground">Beh stále pracuje: {state.currentAction}</p>;
	}
}

export { RunTerminalPanel };
