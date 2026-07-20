import { ArrowDownIcon } from "lucide-react";

import type {
	AuthoredMessageProjection,
	ChannelThreadAction,
	ChannelThreadContent,
	ChannelThreadProjection,
} from "@questpie/ui/components/ai/channel-message";
import { MessagePartList } from "@questpie/ui/components/ai/message-part-list";
import { MessageComposer } from "@questpie/ui/components/ai/message-composer";
import { ActorMark } from "@questpie/ui/components/composites/actor-mark";
import { ActorStack } from "@questpie/ui/components/composites/actor-stack";
import { StateBand } from "@questpie/ui/components/composites/state-band";
import { Status, type StatusState } from "@questpie/ui/components/composites/status";
import { Button } from "@questpie/ui/components/ui/button";
import { Marker, MarkerContent } from "@questpie/ui/components/ui/marker";
import {
	Message,
	MessageAvatar,
	MessageContent,
	MessageFooter,
	MessageHeader,
} from "@questpie/ui/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@questpie/ui/components/ui/message-scroller";
import { Skeleton } from "@questpie/ui/components/ui/skeleton";
import { Spinner } from "@questpie/ui/components/ui/spinner";
import { StatePanel } from "@questpie/ui/components/templates/state-panel";

export type ConversationMessage = AuthoredMessageProjection;

const contentStatus: Record<ChannelThreadContent["kind"], { state: StatusState; label: string }> = {
	ready: { state: "done", label: "Naživo" },
	reconnecting: { state: "attention", label: "Obnovuje spojenie" },
	"replay-gap": { state: "attention", label: "Obnovuje históriu" },
	archived: { state: "idle", label: "Archivované" },
	loading: { state: "idle", label: "Načítava sa" },
	empty: { state: "done", label: "Naživo" },
	error: { state: "failed", label: "Nedostupné" },
	"access-revoked": { state: "blocked", label: "Prístup odobratý" },
};

function hasMessages(
	content: ChannelThreadContent,
): content is Extract<ChannelThreadContent, { messages: readonly AuthoredMessageProjection[] }> {
	return "messages" in content;
}

function ThreadLoading({ label }: { label: string }) {
	return (
		<output className="grid gap-5 p-4" aria-busy="true" aria-label={label}>
			{Array.from({ length: 3 }, (_, index) => (
				<div key={index} className="grid grid-cols-[1.375rem_minmax(0,1fr)] gap-3">
					<Skeleton className="size-[1.375rem] rounded-full" />
					<div className="grid gap-2">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-4 w-full max-w-xl" />
					</div>
				</div>
			))}
		</output>
	);
}

function ThreadMessages({
	messages,
	history,
	onAction,
	scrollToEndLabel,
}: {
	messages: readonly AuthoredMessageProjection[];
	history?: Extract<
		ChannelThreadContent,
		{ messages: readonly AuthoredMessageProjection[] }
	>["history"];
	onAction: (action: ChannelThreadAction) => void;
	scrollToEndLabel: string;
}) {
	return (
		<MessageScrollerProvider autoScroll>
			<MessageScroller className="flex-1">
				<MessageScrollerViewport>
					<MessageScrollerContent className="gap-5 p-4">
						{history ? (
							<div className="flex justify-center">
								<Button
									variant="ghost"
									size="sm"
									disabled={history.state === "loading"}
									onClick={() => onAction({ kind: "load-older-messages" })}
								>
									{history.state === "loading" ? <Spinner data-icon="inline-start" /> : null}
									{history.label} · {history.remaining} správ
								</Button>
							</div>
						) : null}
						<Marker variant="separator">
							<MarkerContent>Dnes</MarkerContent>
						</Marker>
						{messages.map((message) => (
							<MessageScrollerItem
								key={message.id}
								messageId={message.id}
								scrollAnchor={message.anchorOnSend}
							>
								<Message align="start" className="gap-3">
									<MessageAvatar>
										<ActorMark actor={message.actor} size="sm" presence={message.presence} />
									</MessageAvatar>
									<MessageContent>
										<MessageHeader>
											<strong>{message.actor.name}</strong>
											{message.contextLabel ? <span>{message.contextLabel}</span> : null}
											<time dateTime={message.authoredAt.iso}>{message.authoredAt.label}</time>
										</MessageHeader>
										<MessagePartList parts={message.parts} onAction={onAction} />
										{message.delivery && message.delivery.kind !== "persisted" ? (
											<MessageFooter
												data-part="message-delivery"
												data-delivery-state={message.delivery.kind}
												className="gap-2 px-0"
											>
												<Status
													state={message.delivery.kind === "sending" ? "attention" : "failed"}
													label={message.delivery.label}
												/>
												{message.delivery.kind === "failed" ? (
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															onAction({ kind: "retry-message", messageId: message.id })
														}
													>
														{message.delivery.retryLabel}
													</Button>
												) : null}
											</MessageFooter>
										) : null}
									</MessageContent>
								</Message>
							</MessageScrollerItem>
						))}
					</MessageScrollerContent>
				</MessageScrollerViewport>
				<MessageScrollerButton>
					<ArrowDownIcon aria-hidden />
					<span className="sr-only">{scrollToEndLabel}</span>
				</MessageScrollerButton>
			</MessageScroller>
		</MessageScrollerProvider>
	);
}

function ChannelThread({
	projection,
	onAction,
}: {
	projection: ChannelThreadProjection;
	onAction: (action: ChannelThreadAction) => void;
}) {
	const { title, content, composer, scrollToEndLabel = "Prejsť na najnovšiu správu" } = projection;
	const vessel = projection.vessel;
	const threadVessel = vessel.kind === "thread" ? vessel : undefined;
	const status = contentStatus[content.kind];
	const messageContent = hasMessages(content) ? content : undefined;

	return (
		<section
			className="flex min-h-[30rem] min-w-0 flex-col bg-card"
			aria-label={title}
			data-vessel-kind={vessel.kind}
			data-content-state={content.kind}
		>
			<header className="flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-hairline px-4">
				<div className="min-w-0">
					<h2 className="truncate font-semibold">{title}</h2>
					{threadVessel ? (
						<p className="truncate text-[length:var(--type-xs)] text-muted-foreground">
							{threadVessel.anchor.label}
						</p>
					) : null}
				</div>
				<Status state={status.state} label={status.label} />
			</header>
			{threadVessel ? (
				<div
					data-slot="thread-vessel-context"
					className="flex min-h-10 items-center justify-between gap-3 border-b border-hairline bg-canvas-subtle px-4"
				>
					<ActorStack members={threadVessel.participants} size="sm" />
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							onAction({ kind: "toggle-thread-follow", threadId: threadVessel.threadId })
						}
					>
						{threadVessel.follow.label}
					</Button>
				</div>
			) : null}

			<div className="flex min-h-0 flex-1 flex-col">
				{content.kind === "reconnecting" ? (
					<StateBand tone="attention" label={content.label} meta={content.replayLabel} />
				) : null}
				{content.kind === "replay-gap" ? (
					<StateBand
						tone="attention"
						label={content.label}
						meta={content.description}
						action={
							<Button variant="ghost" size="sm" onClick={() => onAction({ kind: "retry-content" })}>
								{content.recoveryLabel}
							</Button>
						}
					/>
				) : null}
				{content.kind === "archived" ? <StateBand tone="neutral" label={content.notice} /> : null}

				{content.kind === "loading" ? <ThreadLoading label={content.label} /> : null}
				{content.kind === "empty" ? (
					<StatePanel state="empty" title={content.title} description={content.description} />
				) : null}
				{content.kind === "error" ? (
					<StatePanel
						state="error"
						title={content.title}
						description={content.description}
						action={
							<Button
								variant="secondary"
								size="sm"
								onClick={() => onAction({ kind: "retry-content" })}
							>
								{content.retryLabel}
							</Button>
						}
					/>
				) : null}
				{content.kind === "access-revoked" ? (
					<StatePanel state="access" title={content.title} description={content.description} />
				) : null}
				{messageContent ? (
					<ThreadMessages
						messages={messageContent.messages}
						history={messageContent.history}
						onAction={onAction}
						scrollToEndLabel={scrollToEndLabel}
					/>
				) : null}
			</div>

			{composer && content.kind !== "archived" && content.kind !== "access-revoked" ? (
				<footer className="shrink-0 bg-card px-4 pb-[max(var(--space-4),var(--safe-bottom))]">
					<MessageComposer
						{...composer}
						access="write"
						onDraftChange={(draft) => onAction({ kind: "composer-draft-change", draft })}
						onSubmit={(draft) => onAction({ kind: "composer-submit", draft })}
						onMentionSelect={(actorId) => onAction({ kind: "composer-mention-select", actorId })}
						onOpenAttachmentPicker={() => onAction({ kind: "composer-open-attachment-picker" })}
					/>
				</footer>
			) : null}
		</section>
	);
}

export { ChannelThread };
