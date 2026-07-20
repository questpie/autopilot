import { Clock3Icon, MessageCircleIcon, SparklesIcon } from "lucide-react";

import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import { Status } from "@questpie/ui/components/composites/status";
import { TechnicalTag } from "@questpie/ui/components/composites/technical-tag";
import {
	WorkRowDetail,
	type WorkRowDetailProjection,
} from "@questpie/ui/components/composites/work-row-detail";
import { Badge } from "@questpie/ui/components/ui/badge";
import { Checkbox } from "@questpie/ui/components/ui/checkbox";
import { cn } from "@questpie/ui/lib/utils";

export type ObjectRowStatus = "running" | "attention" | "blocked" | "idle" | "done";

export interface ObjectRowActorProjection {
	actor: ActorProjection;
	presence?: "online" | "away" | "offline";
}

export interface ObjectRowProgressProjection {
	runId?: string;
	source?: "run-steps" | "task-checklist";
	completed: number;
	total: number;
	dueLabel?: string;
	dueTone?: "neutral" | "attention";
}

export interface ObjectRowNoticeProjection {
	label: string;
	tone: "live" | "attention" | "done";
}

export interface ObjectRowAgentActivityProjection {
	runId?: string;
	actor: ActorProjection;
	label: string;
	elapsed?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export interface ObjectRowSelectionProjection {
	checked: boolean;
	onCheckedChange?: (checked: boolean) => void;
}

export interface ObjectRowProps {
	id: string;
	version?: number;
	title: string;
	tag?: string;
	project?: { id: string; spaceId: string; slug: string; label: string };
	status?: ObjectRowStatus;
	selection?: ObjectRowSelectionProjection;
	progress?: ObjectRowProgressProjection;
	actors?: readonly ObjectRowActorProjection[];
	notice?: ObjectRowNoticeProjection;
	agentActivity?: ObjectRowAgentActivityProjection;
	suggestion?: string;
	comments?: number;
	thread?: { id: string; count: number };
	details?: readonly WorkRowDetailProjection[];
	selected?: boolean;
	disabled?: boolean;
	dimmed?: boolean;
	onActivate?: () => void;
}

const statusToneClass: Record<ObjectRowStatus, string> = {
	running: "work-row-status--running",
	attention: "work-row-status--attention",
	blocked: "work-row-status--blocked",
	idle: "work-row-status--idle",
	done: "work-row-status--done",
};

function ObjectRow({
	id,
	version,
	title,
	tag,
	project,
	status = "idle",
	selection,
	progress,
	actors = [],
	notice,
	agentActivity,
	suggestion,
	comments,
	thread,
	details = [],
	selected = selection?.checked,
	disabled,
	dimmed,
	onActivate,
}: ObjectRowProps) {
	const noticeState =
		notice?.tone === "live" ? "running" : notice?.tone === "done" ? "done" : "attention";
	const progressLabel = progress ? `${progress.completed}/${progress.total}` : undefined;

	return (
		<div
			data-slot="work-object-row"
			data-object-id={id}
			data-object-version={version}
			data-selected={selected || undefined}
			data-disabled={disabled || undefined}
			data-dimmed={dimmed || undefined}
			className="work-object-row"
		>
			{selection ? (
				<Checkbox
					aria-label={`${selection.checked ? "Zrušiť výber" : "Vybrať"}: ${title}`}
					checked={selection.checked}
					disabled={disabled}
					onCheckedChange={selection.onCheckedChange}
				/>
			) : null}
			<span
				data-slot="work-row-status"
				className={cn("work-row-status", statusToneClass[status])}
				aria-hidden
			/>
			{project ? (
				<TechnicalTag
					data-project-id={project.id}
					data-project-space-id={project.spaceId}
					title={project.label}
				>
					{project.slug}
				</TechnicalTag>
			) : tag ? (
				<TechnicalTag>{tag}</TechnicalTag>
			) : null}
			{onActivate ? (
				<button
					type="button"
					className="work-object-row__title"
					aria-label={`Otvoriť úlohu: ${title}`}
					onClick={onActivate}
					disabled={disabled}
					title={title}
				>
					{title}
				</button>
			) : (
				<span className="work-object-row__title" title={title}>
					{title}
				</span>
			)}
			<div className="work-object-row__meta">
				{progress ? (
					<span
						className="work-progress"
						data-progress={progressLabel}
						data-run-id={progress.runId}
						data-progress-source={progress.source}
					>
						<progress
							value={progress.completed}
							max={progress.total}
							aria-label={`${progressLabel} krokov`}
						/>
						<span className="ui-mono">{progressLabel} krokov</span>
						{progress.dueLabel ? (
							<span data-tone={progress.dueTone ?? "neutral"} className="work-row-inline-meta">
								<Clock3Icon aria-hidden />
								{progress.dueLabel}
							</span>
						) : null}
					</span>
				) : null}
				{agentActivity ? (
					<span className="work-agent-activity" data-run-id={agentActivity.runId}>
						<ActorMark actor={agentActivity.actor} presence="online" size="sm" />
						<span className="work-agent-activity__label" title={agentActivity.label}>
							{agentActivity.label}
						</span>
						{agentActivity.elapsed ? (
							<span className="ui-mono work-agent-activity__elapsed">{agentActivity.elapsed}</span>
						) : null}
						{agentActivity.actionLabel && agentActivity.onAction ? (
							<button
								type="button"
								className="work-agent-activity__action"
								onClick={agentActivity.onAction}
							>
								{agentActivity.actionLabel}
							</button>
						) : agentActivity.actionLabel ? (
							<strong className="work-agent-activity__action">{agentActivity.actionLabel}</strong>
						) : null}
					</span>
				) : null}
				{notice ? <Status state={noticeState} label={notice.label} /> : null}
				{suggestion ? (
					<Badge variant="secondary" className="text-agent-ink">
						<SparklesIcon aria-hidden />
						{suggestion}
					</Badge>
				) : null}
				{details.map((detail, index) => (
					<WorkRowDetail key={`${detail.kind}-${index}`} detail={detail} />
				))}
				{thread ? (
					<span
						className="ui-mono work-row-inline-meta"
						data-thread-id={thread.id}
						aria-label={`${thread.count} komentárov`}
					>
						<MessageCircleIcon aria-hidden />
						{thread.count}
					</span>
				) : comments !== undefined ? (
					<span className="ui-mono work-row-inline-meta" aria-label={`${comments} komentárov`}>
						<MessageCircleIcon aria-hidden />
						{comments}
					</span>
				) : null}
				{actors.map(({ actor, presence }) => (
					<span key={actor.id} title={actor.name} data-slot="work-row-actor">
						<ActorMark actor={actor} presence={presence} size="sm" />
						<span className="sr-only">{actor.name}</span>
					</span>
				))}
			</div>
		</div>
	);
}

export { ObjectRow };
