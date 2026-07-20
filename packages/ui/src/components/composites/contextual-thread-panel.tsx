import { ActivityIcon, BookOpenIcon, FileTextIcon, LinkIcon, type LucideIcon } from "lucide-react";

import { ChannelThread, type ConversationMessage } from "@questpie/ui/components/ai/channel-thread";
import type { ChannelThreadAction } from "@questpie/ui/components/ai/channel-message";
import type { MessageComposerProjection } from "@questpie/ui/components/ai/message-composer";
import type { ChannelVesselProjection } from "@questpie/ui/components/ai/channel-message";

export type ObjectEvidenceKind = "knowledge" | "artifact" | "activity" | "reference";

export interface ObjectEvidenceProjection {
	id: string;
	kind: ObjectEvidenceKind;
	label: string;
	detail: string;
}

export interface ContextualThreadProjection {
	title: string;
	vessel: Extract<ChannelVesselProjection, { kind: "thread" }>;
	messages: readonly ConversationMessage[];
	composer: MessageComposerProjection;
	reconnecting?: boolean;
}

export interface ContextualThreadPanelProps {
	evidence: readonly ObjectEvidenceProjection[];
	thread?: ContextualThreadProjection;
	emptyEvidenceLabel?: string;
	readOnlyLabel?: string;
	onEvidenceOpen?: (evidenceId: string) => void;
	onThreadAction?: (action: ChannelThreadAction) => void;
}

const evidenceIcons: Record<ObjectEvidenceKind, LucideIcon> = {
	knowledge: BookOpenIcon,
	artifact: FileTextIcon,
	activity: ActivityIcon,
	reference: LinkIcon,
};

function ContextualThreadPanel({
	evidence,
	thread,
	emptyEvidenceLabel = "Zatiaľ bez dôkazov",
	readOnlyLabel = "Vlákno je iba na čítanie",
	onEvidenceOpen,
	onThreadAction,
}: ContextualThreadPanelProps) {
	const dispatchThread = (action: ChannelThreadAction) => onThreadAction?.(action);
	const threadProjection = thread
		? {
				title: thread.title,
				vessel: thread.vessel,
				content: thread.reconnecting
					? {
							kind: "reconnecting" as const,
							label: "Offline — obnovujeme spojenie",
							replayLabel: "Koncept zostáva zachovaný",
							messages: thread.messages,
						}
					: { kind: "ready" as const, messages: thread.messages },
				composer:
					thread.composer.access === "write"
						? {
								mode: thread.composer.mode,
								draft: thread.composer.draft,
								state: thread.composer.state,
								placeholder: thread.composer.placeholder,
								mentionPicker: thread.composer.mentionPicker,
							}
						: undefined,
			}
		: undefined;

	return (
		<section data-slot="contextual-thread-panel" className="contextual-thread-panel">
			<section
				data-slot="object-evidence"
				className="object-evidence"
				aria-labelledby="evidence-title"
			>
				<header className="object-evidence__header">
					<h2 id="evidence-title">Dôkazy a kontext</h2>
					<span className="ui-type-meta">{evidence.length}</span>
				</header>
				{evidence.length ? (
					<ul className="object-evidence__list">
						{evidence.map((item) => {
							const EvidenceIcon = evidenceIcons[item.kind];
							return (
								<li key={item.id}>
									<button type="button" onClick={() => onEvidenceOpen?.(item.id)}>
										<EvidenceIcon aria-hidden />
										<span>
											<strong>{item.label}</strong>
											<small>{item.detail}</small>
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="object-evidence__empty">{emptyEvidenceLabel}</p>
				)}
			</section>
			{thread && threadProjection ? (
				<div data-slot="contextual-thread-conversation" className="contextual-thread-conversation">
					<ChannelThread projection={threadProjection} onAction={dispatchThread} />
					{thread.composer.access === "read_only" ? (
						<p data-slot="contextual-thread-read-only" className="contextual-thread-read-only">
							{readOnlyLabel}
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}

export { ContextualThreadPanel };
