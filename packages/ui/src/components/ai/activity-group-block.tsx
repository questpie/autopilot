import { ChevronRightIcon, WrenchIcon } from "lucide-react";

import { WorkBlock, WorkBlockHeader } from "@questpie/ui/components/ai/work-block";
import { Button } from "@questpie/ui/components/ui/button";

function ActivityGroupBlock({
	count,
	latest,
	onOpen,
}: {
	count: number;
	latest: string;
	onOpen: () => void;
}) {
	return (
		<WorkBlock>
			<WorkBlockHeader>
				<WrenchIcon aria-hidden />
				<span className="min-w-0 flex-1 truncate">
					Použil {count} nástrojov · naposledy: {latest}
				</span>
				<Button variant="ghost" size="icon-xs" onClick={onOpen} aria-label="Zobraziť aktivitu behu">
					<ChevronRightIcon />
				</Button>
			</WorkBlockHeader>
		</WorkBlock>
	);
}

export { ActivityGroupBlock };
