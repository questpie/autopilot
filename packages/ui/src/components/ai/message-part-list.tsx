import type {
	ChannelMessagePart,
	ChannelThreadAction,
} from "@questpie/ui/components/ai/channel-message";
import { ActivityGroupBlock } from "@questpie/ui/components/ai/activity-group-block";
import { ArtifactBlock } from "@questpie/ui/components/ai/artifact-block";
import { MessageMarkdown } from "@questpie/ui/components/ai/message-markdown";
import { PermissionRequestBlock } from "@questpie/ui/components/ai/permission-request-block";
import { RunCard } from "@questpie/ui/components/ai/run-card";
import { WorkPlanBlock } from "@questpie/ui/components/ai/work-plan-block";

function MessagePartList({
	parts,
	onAction,
}: {
	parts: readonly ChannelMessagePart[];
	onAction: (action: ChannelThreadAction) => void;
}) {
	return (
		<div data-slot="message-part-list" className="flex min-w-0 flex-col gap-2">
			{parts.map((part) => {
				switch (part.kind) {
					case "markdown":
						return (
							<div key={part.id} data-slot="message-part-markdown">
								<MessageMarkdown markdown={part.markdown} streaming={part.streaming} />
							</div>
						);
					case "run":
						return (
							<div key={part.id} data-slot="message-part-run">
								<RunCard
									run={part.run}
									contextual
									onOpenDetail={() => onAction({ kind: "open-run", runId: part.run.id })}
								/>
							</div>
						);
					case "plan":
					case "todo": {
						const steps = part.kind === "plan" ? part.steps : part.items;
						return (
							<div key={part.id} data-slot={`message-part-${part.kind}`}>
								<WorkPlanBlock
									partId={part.id}
									title={part.title}
									steps={steps}
									onToggle={() => onAction({ kind: "toggle-message-part", partId: part.id })}
								/>
							</div>
						);
					}
					case "tool-summary":
						return (
							<div key={part.id} data-slot="message-part-tool-summary">
								<ActivityGroupBlock
									count={part.count}
									latest={part.latest}
									onOpen={() => onAction({ kind: "toggle-message-part", partId: part.id })}
								/>
							</div>
						);
					case "permission":
						return (
							<div key={part.id} data-slot="message-part-permission">
								<PermissionRequestBlock
									{...part}
									onOpenRun={() => onAction({ kind: "open-run", runId: part.runId })}
								/>
							</div>
						);
					case "artifact":
						return (
							<div key={part.id} data-slot="message-part-artifact">
								<ArtifactBlock
									{...part}
									onOpen={() => onAction({ kind: "open-artifact", partId: part.id })}
								/>
							</div>
						);
				}
			})}
		</div>
	);
}

export { MessagePartList };
