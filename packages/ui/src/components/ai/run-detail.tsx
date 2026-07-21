import { ActivityIcon, FileSearchIcon, type LucideIcon } from "lucide-react";

import {
	RunAttemptList,
	type RunAttemptProjection,
} from "@questpie/ui/components/ai/run-attempt-list";
import { RunPermissionList } from "@questpie/ui/components/ai/run-permission-list";
import { RunProvenanceList } from "@questpie/ui/components/ai/run-provenance-list";
import type { RunPermissionProjection, RunProjection } from "@questpie/ui/components/ai/run-state";
import { getRunStateLabel, getRunStateStatus } from "@questpie/ui/components/ai/run-state";
import { RunTerminalPanel } from "@questpie/ui/components/ai/run-terminal-panel";
import { Status } from "@questpie/ui/components/composites/status";
import { Badge } from "@questpie/ui/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@questpie/ui/components/ui/tabs";

export interface RunEventGroup {
	id: string;
	label: string;
	count: number;
	latest: string;
	time: string;
}

export interface RunDetailProjection {
	run: RunProjection;
	groups: readonly RunEventGroup[];
	permissions: readonly RunPermissionProjection[];
	attempts: readonly RunAttemptProjection[];
	defaultTab?: "activity" | "recap" | "evidence" | "permissions" | "attempts";
}

export type RunDetailAction =
	| { kind: "retry"; runId: string }
	| { kind: "open-provenance"; runId: string; recordId: string }
	| {
			kind: "decide-permission";
			runId: string;
			permissionId: string;
			decision: "approve" | "deny";
	  };

function EmptyTab({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
}) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Icon aria-hidden />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function RunDetail({
	projection,
	onAction,
	label = "Detail behu",
}: {
	projection: RunDetailProjection;
	onAction: (action: RunDetailAction) => void;
	label?: string;
}) {
	const { run, groups, permissions, attempts } = projection;
	const recap = run.state.kind === "completed" ? run.state.recap : undefined;
	const evidence = recap?.items.filter((item) => item.kind === "evidence") ?? [];
	const openRecord = (recordId: string) =>
		onAction({ kind: "open-provenance", runId: run.id, recordId });

	return (
		<section className="min-w-0 overflow-hidden" aria-label={label} data-run-state={run.state.kind}>
			<header className="flex items-center justify-between gap-4 border-b p-4">
				<div className="flex items-center gap-3">
					<Badge variant="outline">Beh</Badge>
					<h2 className="font-medium">{run.actor.name}</h2>
				</div>
				<Status
					state={getRunStateStatus(run.state)}
					label={getRunStateLabel(run.state)}
					elapsed={run.elapsed}
				/>
			</header>
			<Tabs defaultValue={projection.defaultTab ?? (recap ? "recap" : "activity")}>
				<TabsList className="max-w-full justify-start overflow-x-auto">
					<TabsTrigger value="activity">Aktivita</TabsTrigger>
					<TabsTrigger value="recap">Výsledok</TabsTrigger>
					<TabsTrigger value="evidence">Dôkazy</TabsTrigger>
					<TabsTrigger value="permissions">Oprávnenia</TabsTrigger>
					<TabsTrigger value="attempts">Pokusy</TabsTrigger>
				</TabsList>
				<TabsContent value="activity">
					{groups.length === 0 ? (
						<EmptyTab
							icon={ActivityIcon}
							title="Bez zaznamenanej aktivity"
							description="Sem pribudnú zoskupené významové kroky, nie surový výpis nástrojov."
						/>
					) : (
						<ul aria-label="Aktivita behu" className="divide-y divide-border-subtle">
							{groups.map((group) => (
								<li key={group.id}>
									<Item className="rounded-none px-4 py-3">
										<ItemMedia variant="icon">
											<ActivityIcon aria-hidden />
										</ItemMedia>
										<ItemContent>
											<ItemTitle>{group.label}</ItemTitle>
											<ItemDescription>
												{group.latest}
												{group.count > 1 ? ` · +${group.count - 1} súvisiacich krokov` : ""}
											</ItemDescription>
										</ItemContent>
										<time className="font-mono text-[length:var(--type-xs)] text-muted-foreground">
											{group.time}
										</time>
									</Item>
								</li>
							))}
						</ul>
					)}
				</TabsContent>
				<TabsContent value="recap">
					<RunTerminalPanel
						state={run.state}
						onRetry={() => onAction({ kind: "retry", runId: run.id })}
						onOpenRecord={openRecord}
					/>
				</TabsContent>
				<TabsContent value="evidence">
					{evidence.length > 0 ? (
						<RunProvenanceList items={evidence} onOpen={openRecord} />
					) : (
						<EmptyTab
							icon={FileSearchIcon}
							title="Zatiaľ bez dôkazov"
							description="Dôkazy sa objavia až po uložení overiteľného podkladu."
						/>
					)}
				</TabsContent>
				<TabsContent value="permissions">
					<RunPermissionList
						permissions={permissions}
						onDecision={(permissionId, decision) =>
							onAction({ kind: "decide-permission", runId: run.id, permissionId, decision })
						}
					/>
				</TabsContent>
				<TabsContent value="attempts">
					<RunAttemptList attempts={attempts} />
				</TabsContent>
			</Tabs>
		</section>
	);
}

export { RunDetail };
