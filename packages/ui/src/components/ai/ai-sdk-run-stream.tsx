import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { Status } from "@questpie/ui/components/composites/status";
import { Alert, AlertDescription, AlertTitle } from "@questpie/ui/components/ui/alert";

export type AiSdkRunBridge = Pick<UseChatHelpers<UIMessage>, "status" | "error">;

export interface AiSdkRunStreamCopy {
	errorTitle: string;
	errorDescription: string;
	submittedLabel: string;
	streamingLabel: string;
	activityFallback: string;
	readyLabel: string;
}

const defaultCopy: AiSdkRunStreamCopy = {
	errorTitle: "Živá aktualizácia bola prerušená",
	errorDescription:
		"Beh môže stále pokračovať. Po obnovení spojenia uvidíte jeho posledný uložený stav.",
	submittedLabel: "Spúšťa sa",
	streamingLabel: "Pracuje",
	activityFallback: "Aktér pracuje…",
	readyLabel: "Spojenie pripravené",
};

/**
 * Projects only transient transport state from @ai-sdk/react 4.0.34.
 * Persisted Messages, Run history, and result projections remain owned by
 * QUESTPIE Query + Channels and are intentionally absent from this boundary.
 * AI SDK `stop()` is deliberately excluded because it only disconnects the
 * client stream; cancelling or steering a durable Run is a separate authorized
 * QUESTPIE command.
 */
function AiSdkRunStream({
	bridge,
	activity,
	copy = defaultCopy,
}: {
	bridge: AiSdkRunBridge;
	activity?: string;
	copy?: AiSdkRunStreamCopy;
}) {
	if (bridge.error)
		return (
			<Alert variant="destructive">
				<AlertTitle>{copy.errorTitle}</AlertTitle>
				<AlertDescription>{copy.errorDescription}</AlertDescription>
			</Alert>
		);
	if (bridge.status === "submitted" || bridge.status === "streaming") {
		return (
			<div className="flex items-center gap-3" data-ai-sdk-transient="true">
				<Status
					state="running"
					label={bridge.status === "submitted" ? copy.submittedLabel : copy.streamingLabel}
				/>
				<span className="shimmer min-w-0 flex-1 truncate text-sm text-muted-foreground">
					{activity ?? copy.activityFallback}
				</span>
			</div>
		);
	}
	return <Status state="idle" label={copy.readyLabel} data-ai-sdk-transient="true" />;
}

export { AiSdkRunStream };
