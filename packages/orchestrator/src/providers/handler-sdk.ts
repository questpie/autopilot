/**
 * Handler SDK — re-exported from @questpie/autopilot-spec/handler-sdk.
 *
 * Surface packs should import directly from '@questpie/autopilot-spec/handler-sdk'.
 * This re-export keeps existing orchestrator-internal imports working.
 */
export {
	defineHandler,
	ok,
	fail,
	taskCreate,
	noop,
	queryMessage,
	conversationApprove,
	conversationReject,
	conversationReply,
	conversationTaskCreate,
	conversationCommand,
} from '@questpie/autopilot-spec/handler-sdk'

export type {
	HandlerEnvelope,
	HandlerResult,
	HandlerFn,
	TaskCreateInput,
	QueryMessageInput,
	ConversationActionInput,
	ConversationTaskCreateInput,
	ConversationCommandInput,
} from '@questpie/autopilot-spec/handler-sdk'
