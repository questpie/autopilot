import { CheckIcon, ChevronDownIcon, CircleIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import type { WorkStepProjection } from "@questpie/ui/components/ai/channel-message";
import {
	WorkBlock,
	WorkBlockContent,
	WorkBlockHeader,
	WorkBlockRow,
} from "@questpie/ui/components/ai/work-block";
import { Button } from "@questpie/ui/components/ui/button";

const stepCopy: Record<WorkStepProjection["state"], string> = {
	pending: "čaká",
	running: "beží",
	done: "hotové",
	failed: "zlyhalo",
};

function StepIcon({ state }: { state: WorkStepProjection["state"] }) {
	switch (state) {
		case "done":
			return <CheckIcon aria-hidden className="text-success-ink" />;
		case "running":
			return <LoaderCircleIcon aria-hidden className="text-action" />;
		case "failed":
			return <XIcon aria-hidden className="text-destructive" />;
		case "pending":
			return <CircleIcon aria-hidden className="text-muted-foreground" />;
	}
}

function WorkPlanBlock({
	partId,
	title,
	steps,
	onToggle,
}: {
	partId: string;
	title: string;
	steps: readonly WorkStepProjection[];
	onToggle: () => void;
}) {
	const visibleSteps = steps.slice(0, 2);
	const hiddenCount = Math.max(0, steps.length - visibleSteps.length);
	const doneCount = steps.filter((step) => step.state === "done").length;

	return (
		<WorkBlock data-part-id={partId}>
			<WorkBlockHeader>
				<strong className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</strong>
				<span className="font-mono text-[length:var(--type-xs)] tabular-nums">
					{doneCount}/{steps.length}
				</span>
			</WorkBlockHeader>
			<WorkBlockContent>
				{visibleSteps.map((step) => (
					<WorkBlockRow key={step.id}>
						<StepIcon state={step.state} />
						<span className="min-w-0 flex-1 truncate">{step.label}</span>
						<span className="text-muted-foreground">{stepCopy[step.state]}</span>
					</WorkBlockRow>
				))}
				{hiddenCount > 0 ? (
					<WorkBlockRow>
						<Button variant="ghost" size="sm" onClick={onToggle}>
							+{hiddenCount} ďalšie
							<ChevronDownIcon data-icon="inline-end" />
						</Button>
					</WorkBlockRow>
				) : null}
			</WorkBlockContent>
		</WorkBlock>
	);
}

export { WorkPlanBlock };
