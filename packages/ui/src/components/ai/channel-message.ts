import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import type { ActorMarkProps } from "@questpie/ui/components/composites/actor-mark";
import type { RunPermissionProjection, RunProjection } from "@questpie/ui/components/ai/run-state";
import type {
	ComposerDraft,
	MessageComposerProjection,
} from "@questpie/ui/components/ai/message-composer";

export interface WorkStepProjection {
	id: string;
	label: string;
	state: "pending" | "running" | "done" | "failed";
}

export type ChannelMessagePart =
	| { id: string; kind: "markdown"; markdown: string; streaming?: boolean }
	| { id: string; kind: "run"; run: RunProjection }
	| { id: string; kind: "plan"; title: string; steps: readonly WorkStepProjection[] }
	| { id: string; kind: "todo"; title: string; items: readonly WorkStepProjection[] }
	| { id: string; kind: "tool-summary"; count: number; latest: string; expanded?: boolean }
	| {
			id: string;
			kind: "permission";
			runId: string;
			permission: RunPermissionProjection;
	  }
	| {
			id: string;
			kind: "artifact";
			title: string;
			mediaType: string;
			provenance: string;
			status: "draft" | "ready" | "failed";
	  };

export interface AuthoredMessageProjection {
	id: string;
	actor: ActorProjection;
	presence?: ActorMarkProps["presence"];
	authoredAt: { iso: string; label: string };
	parts: readonly ChannelMessagePart[];
	delivery?:
		| { kind: "persisted" }
		| { kind: "sending"; label: string }
		| { kind: "failed"; label: string; retryLabel: string };
	contextLabel?: string;
	anchorOnSend?: boolean;
}

export interface ChannelHistoryProjection {
	remaining: number;
	state: "ready" | "loading" | "error";
	label: string;
}

export type ChannelVesselProjection =
	| { kind: "channel"; channelId: string; spaceId: string }
	| {
			kind: "thread";
			threadId: string;
			anchor: { messageId: string; label: string };
			participants: readonly { actor: ActorProjection; presence?: ActorMarkProps["presence"] }[];
			follow: { state: "following" | "not-following"; label: string };
	  };

type MessageContentState = {
	messages: readonly AuthoredMessageProjection[];
	history?: ChannelHistoryProjection;
};

export type ChannelThreadContent =
	| ({ kind: "ready" } & MessageContentState)
	| ({ kind: "reconnecting"; label: string; replayLabel: string } & MessageContentState)
	| ({
			kind: "replay-gap";
			label: string;
			description: string;
			recoveryLabel: string;
	  } & MessageContentState)
	| ({ kind: "archived"; notice: string } & MessageContentState)
	| { kind: "loading"; label: string }
	| { kind: "empty"; title: string; description: string }
	| { kind: "error"; title: string; description: string; retryLabel: string }
	| { kind: "access-revoked"; title: string; description: string };

export interface ChannelThreadProjection {
	title: string;
	vessel: ChannelVesselProjection;
	content: ChannelThreadContent;
	composer?: Omit<MessageComposerProjection, "access">;
	scrollToEndLabel?: string;
}

export type ChannelThreadAction =
	| { kind: "open-run"; runId: string }
	| { kind: "toggle-message-part"; partId: string }
	| { kind: "open-artifact"; partId: string }
	| { kind: "composer-draft-change"; draft: ComposerDraft }
	| { kind: "composer-submit"; draft: ComposerDraft }
	| { kind: "composer-mention-select"; actorId: string }
	| { kind: "composer-open-attachment-picker" }
	| { kind: "retry-message"; messageId: string }
	| { kind: "toggle-thread-follow"; threadId: string }
	| { kind: "load-older-messages" }
	| { kind: "retry-content" };
