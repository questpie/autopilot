import { MessageSquareTextIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ChannelThreadAction } from "@questpie/ui/components/ai/channel-message";
import { MessageMarkdown } from "@questpie/ui/components/ai/message-markdown";
import {
	ContextualThreadPanel,
	type ContextualThreadProjection,
	type ObjectEvidenceProjection,
} from "@questpie/ui/components/composites/contextual-thread-panel";
import { Status, type StatusProps } from "@questpie/ui/components/composites/status";
import { Button } from "@questpie/ui/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

export interface ObjectDetailMetadataItem {
	id: string;
	label: string;
	value: string;
}

export interface ObjectDetailSection {
	id: string;
	title: string;
	markdown: string;
}

export interface ObjectDetailProjection {
	id: string;
	kind: "task" | "goal" | "knowledge";
	eyebrow: string;
	title: string;
	description?: string;
	status?: Pick<StatusProps, "state" | "label" | "elapsed" | "meta">;
	metadata: readonly ObjectDetailMetadataItem[];
	body: {
		lead?: string;
		sections: readonly ObjectDetailSection[];
	};
	evidence: readonly ObjectEvidenceProjection[];
	thread?: ContextualThreadProjection;
}

export type ObjectDetailAction =
	| { type: "evidence-open"; evidenceId: string }
	| { type: "thread-action"; action: ChannelThreadAction };

export interface DocumentDetailProps {
	projection: ObjectDetailProjection;
	onAction?: (action: ObjectDetailAction) => void;
	contextLabel?: string;
	disclosureLabel?: string;
}

function usePinnedContextPanel() {
	const rootRef = useRef<HTMLElement>(null);
	const [pinned, setPinned] = useState(false);

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const update = () => {
			const splitToken = getComputedStyle(root).getPropertyValue("--detail-split-min").trim();
			const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
			const splitWidth = splitToken.endsWith("rem")
				? Number.parseFloat(splitToken) * rootFontSize
				: splitToken.endsWith("px")
					? Number.parseFloat(splitToken)
					: Number.POSITIVE_INFINITY;
			setPinned(root.getBoundingClientRect().width >= splitWidth);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(root);
		return () => observer.disconnect();
	}, []);

	return { rootRef, pinned };
}

function DocumentDetail({
	projection,
	onAction,
	contextLabel = "Vlákno a dôkazy",
	disclosureLabel = "Otvoriť vlákno a dôkazy",
}: DocumentDetailProps) {
	const { rootRef, pinned } = usePinnedContextPanel();
	const mobile = useIsMobile();
	const hasContext = projection.thread != null || projection.evidence.length > 0;
	const contextPanel = (
		<ContextualThreadPanel
			evidence={projection.evidence}
			thread={projection.thread}
			onEvidenceOpen={(evidenceId) => onAction?.({ type: "evidence-open", evidenceId })}
			onThreadAction={(action) => onAction?.({ type: "thread-action", action })}
		/>
	);

	return (
		<section
			ref={rootRef}
			data-slot="object-detail"
			data-object-kind={projection.kind}
			data-context-mode={hasContext ? (pinned ? "pinned" : mobile ? "sheet" : "drawer") : "none"}
			className="ui-object-detail"
		>
			<div data-slot="object-detail-document" className="object-detail-document">
				<header className="object-detail-header">
					<div className="object-detail-header__copy">
						<p className="object-detail-eyebrow">{projection.eyebrow}</p>
						<div className="object-detail-title-row">
							<h1>{projection.title}</h1>
							{projection.status ? <Status {...projection.status} /> : null}
						</div>
						{projection.description ? (
							<p className="object-detail-description">{projection.description}</p>
						) : null}
					</div>
					{hasContext && !pinned ? (
						<Drawer showSwipeHandle={mobile} swipeDirection={mobile ? "down" : "right"}>
							<DrawerTrigger
								render={
									<Button variant="secondary" aria-label={disclosureLabel}>
										<MessageSquareTextIcon data-icon="inline-start" />
										<span>{contextLabel}</span>
										<span className="ui-type-meta">{projection.evidence.length}</span>
									</Button>
								}
							/>
							<DrawerContent className="object-detail-context-drawer">
								<DrawerHeader>
									<DrawerTitle>{contextLabel}</DrawerTitle>
								</DrawerHeader>
								<div data-slot="contextual-panel-safe" className="contextual-panel-safe pb-safe">
									{contextPanel}
								</div>
							</DrawerContent>
						</Drawer>
					) : null}
				</header>
				{projection.metadata.length ? (
					<dl data-slot="object-detail-metadata" className="object-detail-metadata">
						{projection.metadata.map((item) => (
							<div key={item.id}>
								<dt>{item.label}</dt>
								<dd>{item.value}</dd>
							</div>
						))}
					</dl>
				) : null}
				<article data-slot="object-detail-body" className="object-detail-body">
					{projection.body.lead ? (
						<p className="object-detail-lead">{projection.body.lead}</p>
					) : null}
					{projection.body.sections.map((section) => (
						<section key={section.id} aria-labelledby={`${projection.id}-${section.id}`}>
							<h2 id={`${projection.id}-${section.id}`}>{section.title}</h2>
							<MessageMarkdown markdown={section.markdown} />
						</section>
					))}
				</article>
			</div>
			{hasContext && pinned ? (
				<aside className="ui-document-thread" aria-label={contextLabel}>
					{contextPanel}
				</aside>
			) : null}
		</section>
	);
}

export { DocumentDetail };
