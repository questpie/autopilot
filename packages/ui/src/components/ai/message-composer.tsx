import { AtSignIcon, FileTextIcon, PaperclipIcon, PlusIcon, SendIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useId } from "react";

import { AdaptiveMenu } from "@questpie/ui/components/composites/adaptive-menu";
import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import { ActorChip } from "@questpie/ui/components/composites/actor-chip";
import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentMedia,
	AttachmentTitle,
} from "@questpie/ui/components/ui/attachment";
import { Button } from "@questpie/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@questpie/ui/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupTextarea,
} from "@questpie/ui/components/ui/input-group";
import { Spinner } from "@questpie/ui/components/ui/spinner";

export interface ComposerDraft {
	text: string;
	clientNonce: string;
	mentions: readonly {
		nodeId: string;
		actorId: string;
		actorKind: ActorProjection["kind"];
		label: string;
	}[];
	attachments: readonly {
		id: string;
		kind: "file" | "knowledge" | "object" | "artifact";
		label: string;
		sourceId: string;
		scope: { companyId: string; spaceId?: string };
	}[];
}

export interface ComposerMentionPickerProjection {
	label: string;
	actors: readonly ActorProjection[];
	state: "ready" | "loading" | "empty" | "disabled";
}

export interface MessageComposerProjection {
	mode: "channel" | "thread";
	draft: ComposerDraft;
	state: "ready" | "submitting" | "reconnecting" | "error";
	access: "write" | "read_only" | "archived";
	placeholder?: string;
	mentionPicker?: ComposerMentionPickerProjection;
}

export interface MessageComposerProps extends MessageComposerProjection {
	onDraftChange: (draft: ComposerDraft) => void;
	onSubmit: (draft: ComposerDraft) => void;
	onMentionSelect?: (actorId: string) => void;
	onOpenAttachmentPicker?: () => void;
}

function MessageComposer({
	mode,
	draft,
	state,
	access,
	placeholder = mode === "thread" ? "Odpovedzte vo vlákne…" : "Napíšte do kanála…",
	onDraftChange,
	onSubmit,
	onMentionSelect,
	onOpenAttachmentPicker,
	mentionPicker,
}: MessageComposerProps) {
	const inputId = useId();
	const isSubmitting = state === "submitting";
	const cannotSubmit = !draft.text.trim() || isSubmitting || state === "reconnecting";

	if (access !== "write") {
		return null;
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		if (cannotSubmit) return;
		onSubmit(draft);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
		event.preventDefault();
		if (!cannotSubmit) onSubmit(draft);
	}

	return (
		<form data-slot="message-composer" onSubmit={submit}>
			<FieldGroup>
				<Field data-invalid={state === "error" || undefined}>
					<FieldLabel className="sr-only" htmlFor={inputId}>
						{placeholder}
					</FieldLabel>
					<InputGroup className="message-composer-control rounded-[var(--radius-md)] has-disabled:bg-canvas-subtle! has-disabled:opacity-100">
						{draft.mentions.length || draft.attachments.length ? (
							<InputGroupAddon align="block-start" className="flex-wrap justify-start gap-2">
								{draft.mentions.map((mention) => (
									<div
										key={mention.nodeId}
										data-part="composer-mention"
										data-mention-node-id={mention.nodeId}
										data-actor-id={mention.actorId}
									>
										<ActorChip
											actor={{
												id: mention.actorId,
												name: mention.label,
												kind: mention.actorKind,
											}}
											size="sm"
										/>
									</div>
								))}
								{draft.attachments.length ? (
									<AttachmentGroup>
										{draft.attachments.map((attachment) => (
											<Attachment
												key={attachment.id}
												data-part="composer-attachment"
												data-attachment-id={attachment.id}
												data-source-id={attachment.sourceId}
												state="done"
												size="xs"
											>
												<AttachmentMedia variant="icon">
													<FileTextIcon />
												</AttachmentMedia>
												<AttachmentContent>
													<AttachmentTitle>{attachment.label}</AttachmentTitle>
													<AttachmentDescription>
														{attachment.kind} · {attachment.sourceId}
													</AttachmentDescription>
												</AttachmentContent>
											</Attachment>
										))}
									</AttachmentGroup>
								) : null}
							</InputGroupAddon>
						) : null}
						<InputGroupTextarea
							id={inputId}
							value={draft.text}
							onChange={(event) => onDraftChange({ ...draft, text: event.currentTarget.value })}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							rows={2}
							aria-invalid={state === "error" || undefined}
						/>
						<InputGroupAddon align="block-end" className="justify-between">
							<div className="flex items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={onOpenAttachmentPicker}
									aria-label="Pridať prílohu"
								>
									<PlusIcon />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon-xs"
									onClick={onOpenAttachmentPicker}
									aria-label="Priložiť kontext alebo Znalosť"
								>
									<PaperclipIcon />
								</Button>
								{mentionPicker ? (
									<AdaptiveMenu
										label={mentionPicker.label}
										trigger={
											<Button
												type="button"
												variant="ghost"
												size="icon-xs"
												aria-label="Spomenúť aktéra"
												disabled={mentionPicker.state !== "ready"}
											>
												<AtSignIcon />
											</Button>
										}
										items={mentionPicker.actors.map((actor) => ({
											id: actor.id,
											label: actor.name,
											actor,
											onSelect: () => onMentionSelect?.(actor.id),
										}))}
									/>
								) : null}
							</div>
							<Button variant="secondary" size="sm" type="submit" disabled={cannotSubmit}>
								{isSubmitting ? (
									<Spinner data-icon="inline-start" />
								) : (
									<SendIcon data-icon="inline-start" />
								)}
								Odoslať správu
							</Button>
						</InputGroupAddon>
					</InputGroup>
					{state === "reconnecting" ? (
						<FieldDescription>
							Offline — obnovujeme spojenie; váš koncept zostáva zachovaný.
						</FieldDescription>
					) : null}
				</Field>
			</FieldGroup>
		</form>
	);
}

export { MessageComposer };
