import { ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";

import {
	WorkBlock,
	WorkBlockContent,
	WorkBlockFooter,
	WorkBlockHeader,
} from "@questpie/ui/components/ai/work-block";
import type { RunPermissionProjection } from "@questpie/ui/components/ai/run-state";
import { ActorIdentity } from "@questpie/ui/components/composites/actor-identity";
import { Status } from "@questpie/ui/components/composites/status";
import { Button } from "@questpie/ui/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@questpie/ui/components/ui/empty";
import { cn } from "@questpie/ui/lib/utils";

const decisionCopy = {
	pending: "Čaká na rozhodnutie",
	approved: "Povolené",
	denied: "Zamietnuté",
	expired: "Vypršalo",
} as const;

function RunPermissionList({
	permissions,
	onDecision,
}: {
	permissions: readonly RunPermissionProjection[];
	onDecision: (permissionId: string, decision: "approve" | "deny") => void;
}) {
	if (permissions.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ShieldCheckIcon aria-hidden />
					</EmptyMedia>
					<EmptyTitle>Bez žiadostí</EmptyTitle>
					<EmptyDescription>Tento Beh zatiaľ nepožiadal o ďalšie oprávnenie.</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		// Gap-separated bounded caution cards, not hairline-divided rows (board .approval
		// is a discrete gold-contained object, primitives.css:51-64), so the gate reads as
		// objects rather than a border.
		<ul aria-label="Žiadosti o oprávnenie" className="grid gap-3 p-4">
			{permissions.map((permission) => {
				const pending = permission.decision === "pending";
				return (
					<li key={permission.id}>
						<WorkBlock
							data-part="run-permission"
							data-permission-id={permission.id}
							data-decision={permission.decision}
							// The WorkBlock chrome is a hairline ring (Card ring-1); retint it gold
							// while pending so the gate reads as a bounded caution object (board
							// .approval gold border), not a neutral card.
							className={cn(pending && "ring-warning-border")}
						>
							<WorkBlockHeader
								className={cn(
									"text-foreground",
									pending && "bg-warning-surface text-warning-foreground",
								)}
							>
								<ShieldAlertIcon aria-hidden />
								<strong className="min-w-0 flex-1 truncate font-semibold">
									{permission.capability}
								</strong>
								<Status
									state={
										pending ? "attention" : permission.decision === "approved" ? "done" : "blocked"
									}
									label={decisionCopy[permission.decision]}
								/>
							</WorkBlockHeader>
							<WorkBlockContent>
								<dl className="grid gap-3 px-3 py-2.5 text-[length:var(--type-lg)] leading-[1.45] sm:grid-cols-2">
									<div className="grid min-w-0 gap-0.5">
										<dt className="text-[length:var(--type-sm)] text-muted-foreground">Rozsah</dt>
										<dd className="text-pretty text-foreground">{permission.scope}</dd>
									</div>
									<div className="grid min-w-0 gap-0.5">
										<dt className="text-[length:var(--type-sm)] text-muted-foreground">Dôsledok</dt>
										<dd className="text-pretty text-foreground">{permission.consequence}</dd>
									</div>
								</dl>
							</WorkBlockContent>
							<WorkBlockFooter className="flex-wrap gap-3">
								<ActorIdentity actor={permission.requestedBy} size="sm" />
								{pending && permission.canDecide ? (
									<div className="flex gap-2">
										<Button
											variant="secondary"
											size="sm"
											onClick={() => onDecision(permission.id, "deny")}
										>
											Zamietnuť
										</Button>
										<Button size="sm" onClick={() => onDecision(permission.id, "approve")}>
											Povoliť
										</Button>
									</div>
								) : pending ? (
									<p className="max-w-xs text-right text-pretty text-[length:var(--type-xs)] text-muted-foreground">
										Žiadajúci Aktér nemôže schváliť vlastnú žiadosť.
									</p>
								) : null}
							</WorkBlockFooter>
						</WorkBlock>
					</li>
				);
			})}
		</ul>
	);
}

export { RunPermissionList };
