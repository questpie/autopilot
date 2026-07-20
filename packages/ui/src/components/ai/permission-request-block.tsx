import { ShieldAlertIcon } from "lucide-react";

import {
	WorkBlock,
	WorkBlockContent,
	WorkBlockFooter,
	WorkBlockHeader,
	WorkBlockRow,
} from "@questpie/ui/components/ai/work-block";
import type { RunPermissionProjection } from "@questpie/ui/components/ai/run-state";
import { ActorIdentity } from "@questpie/ui/components/composites/actor-identity";
import { Button } from "@questpie/ui/components/ui/button";
import { Status } from "@questpie/ui/components/composites/status";

const decisionCopy = {
	pending: "Čaká na rozhodnutie",
	approved: "Povolené",
	denied: "Zamietnuté",
	expired: "Vypršalo",
} as const;

function PermissionRequestBlock({
	runId,
	permission,
	onOpenRun,
}: {
	runId: string;
	permission: RunPermissionProjection;
	onOpenRun: () => void;
}) {
	const { capability, scope, consequence, requestedBy, decision, expiresAt } = permission;

	return (
		<WorkBlock data-run-id={runId}>
			<WorkBlockHeader>
				<ShieldAlertIcon aria-hidden />
				<strong className="min-w-0 flex-1 truncate font-medium text-foreground">
					Žiadosť o povolenie
				</strong>
				<Status
					state={
						decision === "pending" ? "attention" : decision === "approved" ? "done" : "blocked"
					}
					label={decisionCopy[decision]}
				/>
			</WorkBlockHeader>
			<WorkBlockContent>
				<WorkBlockRow>
					<strong className="min-w-0 flex-1 font-medium">{capability}</strong>
					<ActorIdentity actor={requestedBy} size="sm" />
				</WorkBlockRow>
				<WorkBlockRow className="items-start">
					<span className="min-w-0 flex-1">{consequence}</span>
				</WorkBlockRow>
			</WorkBlockContent>
			<WorkBlockFooter>
				<div className="min-w-0 flex-1 text-[length:var(--type-xs)] text-muted-foreground">
					<p>
						{scope}
						{expiresAt ? ` · do ${expiresAt}` : null}
					</p>
					{decision === "pending" ? <p>Rozhodnutie je dostupné v detaile behu.</p> : null}
				</div>
				<Button variant="ghost" size="sm" onClick={onOpenRun}>
					Otvoriť detail behu
				</Button>
			</WorkBlockFooter>
		</WorkBlock>
	);
}

export { PermissionRequestBlock };
