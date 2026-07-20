import { MessageCircleIcon, SparklesIcon } from "lucide-react";

import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import type { ObjectRowProps } from "@questpie/ui/components/composites/object-row";
import { Status } from "@questpie/ui/components/composites/status";
import { TechnicalTag } from "@questpie/ui/components/composites/technical-tag";
import { Badge } from "@questpie/ui/components/ui/badge";

export type WorkObjectCardProps = Omit<ObjectRowProps, "details" | "progress">;

// Kanban projection of a work object — the board `.card` grammar (work.html:353-357):
// a bounded white surface card, title line over a between-row (tag + lead avatar left,
// one state/notice chip right). Nothing wraps; status is carried by the column.
function WorkObjectCard({
	id,
	version,
	title,
	tag,
	project,
	actors = [],
	notice,
	suggestion,
	comments,
	thread,
	selected,
	disabled,
	dimmed,
	onActivate,
}: WorkObjectCardProps) {
	const leadActor = actors[0];
	const noticeState =
		notice?.tone === "live" ? "running" : notice?.tone === "done" ? "done" : "attention";
	const commentCount = thread?.count ?? comments;
	const hasFoot = Boolean(
		project || tag || leadActor || notice || suggestion || commentCount !== undefined,
	);

	return (
		<article
			data-slot="work-object-card"
			data-object-id={id}
			data-object-version={version}
			data-selected={selected || undefined}
			data-disabled={disabled || undefined}
			data-dimmed={dimmed || undefined}
			className="work-object-card"
		>
			{onActivate ? (
				<button
					type="button"
					className="work-object-card__title"
					onClick={onActivate}
					disabled={disabled}
					title={title}
					aria-label={`Otvoriť úlohu: ${title}`}
				>
					{title}
				</button>
			) : (
				<span className="work-object-card__title" title={title}>
					{title}
				</span>
			)}
			{hasFoot ? (
				<div className="work-object-card__foot">
					<span className="work-object-card__lead">
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
						{leadActor ? (
							<span title={leadActor.actor.name} data-slot="work-row-actor">
								<ActorMark actor={leadActor.actor} presence={leadActor.presence} size="sm" />
								<span className="sr-only">{leadActor.actor.name}</span>
							</span>
						) : null}
					</span>
					<span className="work-object-card__trail">
						{notice ? (
							<Status state={noticeState} label={notice.label} />
						) : suggestion ? (
							<Badge variant="secondary" className="text-agent-ink">
								<SparklesIcon aria-hidden />
								{suggestion}
							</Badge>
						) : commentCount !== undefined ? (
							<span
								className="ui-mono work-row-inline-meta"
								data-thread-id={thread?.id}
								aria-label={`${commentCount} komentárov`}
							>
								<MessageCircleIcon aria-hidden />
								{commentCount}
							</span>
						) : null}
					</span>
				</div>
			) : null}
		</article>
	);
}

export { WorkObjectCard };
