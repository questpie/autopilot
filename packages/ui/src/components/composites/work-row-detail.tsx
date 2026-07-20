import { Clock3Icon, LockKeyholeIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";

import { Button } from "@questpie/ui/components/ui/button";

export type WorkRowDetailProjection =
	| { kind: "text"; label: string; tone?: "neutral" | "attention"; referenceId?: string }
	| { kind: "permission"; label: string; referenceId?: string }
	| { kind: "schedule"; label: string; iso?: string }
	| { kind: "provenance"; label: string; effectId?: string; runId?: string }
	| { kind: "automation"; label: string; effectId?: string; runId?: string }
	| { kind: "undo"; label: string; effectId?: string; onSelect?: () => void };

export interface WorkRowDetailProps {
	detail: WorkRowDetailProjection;
}

function WorkRowDetail({ detail }: WorkRowDetailProps) {
	switch (detail.kind) {
		case "permission":
			return (
				<span
					className="work-row-detail"
					data-detail="permission"
					data-reference-id={detail.referenceId}
				>
					<LockKeyholeIcon aria-hidden />
					{detail.label}
				</span>
			);
		case "schedule":
			return (
				<span
					className="work-row-detail work-row-detail--pill"
					data-detail="schedule"
					data-scheduled-for={detail.iso}
				>
					<Clock3Icon aria-hidden />
					{detail.label}
				</span>
			);
		case "provenance":
			return (
				<span
					className="work-row-detail work-row-detail--agent"
					data-detail="provenance"
					data-effect-id={detail.effectId}
					data-run-id={detail.runId}
				>
					<span className="work-row-detail__dot" aria-hidden />
					{detail.label}
				</span>
			);
		case "automation":
			return (
				<span
					className="work-row-detail work-row-detail--automation"
					data-detail="automation"
					data-effect-id={detail.effectId}
					data-run-id={detail.runId}
				>
					<SparklesIcon aria-hidden />
					{detail.label}
				</span>
			);
		case "undo":
			return (
				<Button
					variant="ghost"
					size="sm"
					data-effect-id={detail.effectId}
					onClick={detail.onSelect}
				>
					<RotateCcwIcon data-icon="inline-start" aria-hidden />
					{detail.label}
				</Button>
			);
		case "text":
			return (
				<span
					className="work-row-detail"
					data-tone={detail.tone ?? "neutral"}
					data-reference-id={detail.referenceId}
				>
					{detail.label}
				</span>
			);
	}
}

export { WorkRowDetail };
