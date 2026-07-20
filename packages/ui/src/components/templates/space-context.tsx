import { ChevronDownIcon, PlusIcon, type LucideIcon } from "lucide-react";

import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import type { ObjectRowActorProjection } from "@questpie/ui/components/composites/object-row";
import { Button } from "@questpie/ui/components/ui/button";

export interface SpaceProjectProjection {
	label: string;
	value: string;
}

export interface SpaceContextProps {
	icon?: LucideIcon;
	title: string;
	project?: string | SpaceProjectProjection;
	meta?: string;
	members?: readonly ObjectRowActorProjection[];
	inviteLabel?: string;
	onChangeProject?: () => void;
	onInvite?: () => void;
}

function SpaceContext({
	icon: Icon,
	title,
	project,
	meta,
	members = [],
	inviteLabel,
	onChangeProject,
	onInvite,
}: SpaceContextProps) {
	const projectLabel = typeof project === "string" ? "Projekt" : project?.label;
	const projectValue = typeof project === "string" ? project : project?.value;
	const visibleMembers = members.slice(0, 4);
	const hiddenMemberCount = members.length - visibleMembers.length;

	return (
		<header
			data-slot="space-context"
			className="space-context flex min-h-[var(--shell-topbar)] items-center gap-3 border-b border-hairline px-4"
		>
			{Icon ? <Icon data-slot="space-context-icon" aria-hidden /> : null}
			<h1 className="ui-type-topbar-title truncate">{title}</h1>
			{projectValue ? (
				<Button
					className="space-context__project"
					variant="secondary"
					size="sm"
					onClick={onChangeProject}
				>
					<span className="font-normal text-ink-muted">{projectLabel}:</span>
					{projectValue}
					<ChevronDownIcon data-icon="inline-end" />
				</Button>
			) : null}
			{meta ? (
				<span className="space-context__meta ui-type-meta truncate text-ink-muted">{meta}</span>
			) : null}
			{visibleMembers.length ? (
				<div data-slot="space-members" className="ml-auto flex items-center -space-x-1">
					{visibleMembers.map(({ actor, presence }) => (
						<span key={actor.id} title={actor.name}>
							<ActorMark actor={actor} presence={presence} size="sm" />
							<span className="sr-only">{actor.name}</span>
						</span>
					))}
					{hiddenMemberCount > 0 ? (
						<span className="ui-mono flex size-[1.375rem] items-center justify-center rounded-full bg-surface-muted text-ink-muted">
							+{hiddenMemberCount}
						</span>
					) : null}
				</div>
			) : null}
			{inviteLabel ? (
				<Button className="space-context__invite" variant="secondary" size="sm" onClick={onInvite}>
					<PlusIcon data-icon="inline-start" />
					{inviteLabel}
				</Button>
			) : null}
		</header>
	);
}

export { SpaceContext };
