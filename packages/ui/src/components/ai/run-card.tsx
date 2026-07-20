import { ActivityIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";

import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import { Status } from "@questpie/ui/components/composites/status";
import {
	WorkBlock,
	WorkBlockContent,
	WorkBlockFooter,
	WorkBlockHeader,
	WorkBlockRow,
} from "@questpie/ui/components/ai/work-block";
import {
	getRunStateLabel,
	getRunStateStatus,
	type RunPresentationState,
	type RunProjection,
} from "@questpie/ui/components/ai/run-state";
import { Button } from "@questpie/ui/components/ui/button";

function runStateSummary(state: RunPresentationState) {
	switch (state.kind) {
		case "live":
			return state.currentAction;
		case "waiting-permission":
			return `${state.permission.capability} · ${state.permission.scope}`;
		case "failed":
			return state.summary;
		case "reconnecting":
			return `${state.label} · ${state.replayLabel}`;
		case "cancel-requested":
			return `${state.label} · ${state.requestedBy.name} · ${state.requestedAt}`;
		case "rejected":
			return `${state.reason} · ${state.occurredAt}`;
		case "timed-out":
			return `${state.summary} · ${state.occurredAt}`;
		case "cancelled":
			return `${state.reason} · ${state.cancelledAt}`;
		case "completed":
			return state.recap.summary;
	}
}

function RunCard({
	run,
	onOpenDetail,
	onRetry,
	contextual = false,
}: {
	run: RunProjection;
	onOpenDetail: () => void;
	onRetry?: () => void;
	contextual?: boolean;
}) {
	const summary = runStateSummary(run.state);
	const retryLabel =
		run.state.kind === "failed" || run.state.kind === "timed-out"
			? run.state.retryLabel
			: undefined;

	return (
		<WorkBlock
			data-part="run-summary"
			// A bounded run object is a raised WHITE object on the thread (board .run sits
			// on --color-surface); the canvas-subtle rail tone inverted figure/ground.
			className="run-card grid h-[var(--run-card-height)] max-w-2xl grid-rows-[2.25rem_minmax(0,1fr)_2.25rem] bg-surface"
			data-fixed-height="true"
			data-run-phase={run.state.kind === "live" ? run.state.phase : undefined}
			data-run-state={run.state.kind}
		>
			<WorkBlockHeader className="run-card__header min-h-0 border-b px-3 py-1 pb-1!">
				{contextual ? null : <ActorMark actor={run.actor} size="sm" />}
				<strong className="min-w-0 flex-1 truncate font-semibold text-foreground">
					{contextual ? "Priebeh práce" : run.actor.name}
				</strong>
				<Status
					state={getRunStateStatus(run.state)}
					label={getRunStateLabel(run.state)}
					elapsed={run.elapsed}
				/>
			</WorkBlockHeader>
			<WorkBlockContent className="run-card__activity grid min-h-0 grid-rows-2 overflow-hidden">
				<WorkBlockRow className="h-9 min-h-0 py-1.5">
					<span className="size-[0.4375rem] rounded-full bg-action" aria-hidden />
					<span
						data-slot={run.state.kind === "live" ? "run-current-action" : "run-state-summary"}
						className="min-w-0 flex-1 truncate"
					>
						{summary}
					</span>
				</WorkBlockRow>
				<WorkBlockRow className="h-9 min-h-0 py-1.5">
					<ActivityIcon aria-hidden />
					<span className="min-w-0 flex-1 truncate text-muted-foreground">{run.activity}</span>
				</WorkBlockRow>
			</WorkBlockContent>
			<WorkBlockFooter className="run-card__footer min-h-0 px-3 py-1">
				<span className="text-[length:var(--type-xs)] text-muted-foreground tabular-nums">
					{run.hiddenActivityCount
						? `+${run.hiddenActivityCount} ďalších udalostí`
						: "Aktivita je zoskupená"}
				</span>
				<div className="flex shrink-0 items-center gap-1">
					{retryLabel && onRetry ? (
						<Button variant="secondary" size="sm" onClick={onRetry}>
							<RotateCcwIcon data-icon="inline-start" aria-hidden />
							{retryLabel}
						</Button>
					) : null}
					<Button variant="ghost" size="sm" onClick={onOpenDetail}>
						<span className={retryLabel ? "sr-only" : "hidden sm:inline"}>
							Zobraziť detail behu
						</span>
						{retryLabel ? null : <span className="sm:hidden">Detail behu</span>}
						<ChevronRightIcon data-icon="inline-end" aria-hidden />
					</Button>
				</div>
			</WorkBlockFooter>
		</WorkBlock>
	);
}

export { RunCard };
