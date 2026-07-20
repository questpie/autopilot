import { ChevronRightIcon, FileTextIcon } from "lucide-react";

import { WorkBlock, WorkBlockFooter, WorkBlockHeader } from "@questpie/ui/components/ai/work-block";
import { Button } from "@questpie/ui/components/ui/button";
import { Status } from "@questpie/ui/components/composites/status";

const artifactCopy = { draft: "Koncept", ready: "Pripravené", failed: "Zlyhalo" } as const;

function ArtifactBlock({
	title,
	mediaType,
	provenance,
	status,
	onOpen,
}: {
	title: string;
	mediaType: string;
	provenance: string;
	status: keyof typeof artifactCopy;
	onOpen: () => void;
}) {
	return (
		<WorkBlock>
			<WorkBlockHeader>
				<FileTextIcon aria-hidden />
				<strong className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</strong>
				<Status
					state={status === "ready" ? "done" : status === "failed" ? "failed" : "idle"}
					label={artifactCopy[status]}
				/>
			</WorkBlockHeader>
			<WorkBlockFooter>
				<span className="text-[length:var(--type-xs)] text-muted-foreground">
					{mediaType} · {provenance}
				</span>
				<Button variant="ghost" size="sm" onClick={onOpen}>
					Otvoriť
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			</WorkBlockFooter>
		</WorkBlock>
	);
}

export { ArtifactBlock };
