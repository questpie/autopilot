import { RotateCcwIcon } from "lucide-react";

import { Status, type StatusState } from "@questpie/ui/components/composites/status";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@questpie/ui/components/ui/empty";
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@questpie/ui/components/ui/item";

export interface RunAttemptProjection {
	id: string;
	label: string;
	status: "running" | "failed" | "cancelled" | "completed";
	startedAt: string;
	endedAt?: string;
	summary?: string;
}

const attemptState: Record<RunAttemptProjection["status"], StatusState> = {
	running: "running",
	failed: "failed",
	cancelled: "blocked",
	completed: "done",
};

const attemptLabel: Record<RunAttemptProjection["status"], string> = {
	running: "Pracuje",
	failed: "Zlyhal",
	cancelled: "Zrušený",
	completed: "Dokončený",
};

function RunAttemptList({ attempts }: { attempts: readonly RunAttemptProjection[] }) {
	if (attempts.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<RotateCcwIcon aria-hidden />
					</EmptyMedia>
					<EmptyTitle>Bez pokusov</EmptyTitle>
					<EmptyDescription>Pokus sa objaví po spustení práce.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<ul aria-label="Pokusy behu" className="divide-y divide-hairline">
			{attempts.map((attempt) => (
				<li key={attempt.id}>
					<Item className="rounded-none px-4 py-3">
						<ItemMedia variant="icon">
							<RotateCcwIcon aria-hidden />
						</ItemMedia>
						<ItemContent>
							<ItemTitle>{attempt.label}</ItemTitle>
							<ItemDescription>
								{attempt.summary ?? `Začal ${attempt.startedAt}`}
								{attempt.endedAt ? ` · skončil ${attempt.endedAt}` : ""}
							</ItemDescription>
						</ItemContent>
						<Status state={attemptState[attempt.status]} label={attemptLabel[attempt.status]} />
					</Item>
				</li>
			))}
		</ul>
	);
}

export { RunAttemptList };
