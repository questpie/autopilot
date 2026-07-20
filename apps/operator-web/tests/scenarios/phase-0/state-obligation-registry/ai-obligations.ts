import { stableSelectors as selector } from "../contracts";
import { phase0QueryStateCoverage } from "./query-coverage";
import type { StateObligation } from "./types";

export const aiStateObligations = [
	{
		id: "US-AI-SETUP-01",
		ownerFlow: "F02",
		proofTask: "prove-f02-provider-gated-autopilot-activation",
		reusedBy: ["F10"],
		selectors: [
			selector.screenAiSetup,
			selector.providerVerifyAction,
			selector.agentActivateAction,
		],
		fixtureModeIds: [
			"ai-setup:unconfigured",
			"ai-setup:verifying",
			"ai-setup:invalid-credential",
			"ai-setup:stale-verification",
			"ai-setup:model-less",
			"ai-setup:provider-unavailable",
			"ai-setup:worker-unavailable",
			"ai-setup:ready",
		],
		layers: ["http", "integration", "browser"],
		absenceAssertion:
			"No secret echo, raw ready toggle, infinite spinner, ambient credential, fallback, fake Run, or fake success occurs.",
	},
	{
		id: "US-RUN-LIVE-01",
		ownerFlow: "F04",
		proofTask: "prove-f04-structured-mention-to-attributable-result",
		reusedBy: ["F05", "F08"],
		selectors: [selector.messageRunCard, selector.screenChannelThread],
		fixtureModeIds: [
			"run-live:submitted",
			"run-live:queued",
			"run-live:evaluating",
			"run-live:working",
			"run-live:reconnecting",
			"run-live:terminal-result",
			"run-live:long-structured-content",
		],
		layers: ["integration", "browser", "realtime"],
		absenceAssertion:
			"No instant result, unbounded card, raw tool dump, bubble-only chat, motion-only meaning, or merged authorship appears.",
	},
	{
		id: "US-PERMISSION-01",
		ownerFlow: "F06",
		proofTask: "prove-f06-exact-run-permission-decision",
		reusedBy: [],
		selectors: [selector.screenNeedsYou, selector.screenRunDetail, selector.permissionRoutingState],
		fixtureModeIds: [
			"permission:waiting",
			"permission:eligible-approval",
			"permission:denied",
			"permission:no-approver",
			"permission:configuration-only",
			"permission:expired",
			"permission:newly-ineligible",
			"permission:delayed-acknowledgement",
		],
		layers: ["http", "integration", "browser"],
		absenceAssertion:
			"No instant resume, widened grant, unauthorized approval, duplicate effect, stale decision, or existence leak occurs.",
	},
	{
		id: "US-RUN-CANCEL-01",
		ownerFlow: "F07",
		proofTask: "prove-f07-durable-cancel-and-fresh-authority-retry",
		reusedBy: [],
		selectors: [selector.screenRunDetail, selector.runCancelAction],
		fixtureModeIds: [
			"run-cancel:queued",
			"run-cancel:delivered",
			"run-cancel:safe-boundary",
			"run-cancel:late",
			"run-cancel:duplicate",
		],
		layers: ["integration", "browser"],
		absenceAssertion:
			"No client abort masquerades as cancellation, attempt reopens, committed effect disappears, or terminal transition duplicates.",
	},
	{
		id: "US-RUN-RETRY-01",
		ownerFlow: "F07",
		proofTask: "prove-f07-durable-cancel-and-fresh-authority-retry",
		reusedBy: ["F10"],
		selectors: [selector.screenRunDetail, selector.runRetryAction, selector.messageRunCard],
		fixtureModeIds: [
			"run-retry:retryable-failure",
			"run-retry:explicit-command",
			"run-retry:linked-attempt",
			"run-retry:fresh-authority",
		],
		layers: ["integration", "browser"],
		absenceAssertion:
			"No fallback, mutable deadline, reused revoked authority, mutated terminal attempt, or erased failure evidence occurs.",
	},
	{
		id: "US-CAPACITY-LOSS-01",
		ownerFlow: "F10",
		proofTask: "prove-f10-provider-and-capacity-loss-without-fallback",
		reusedBy: [],
		selectors: [selector.screenAiSetup, selector.messageRunCard],
		fixtureModeIds: [
			"capacity:known-invalid-admission",
			"capacity:transient-loss",
			"capacity:captured-deadline",
			"capacity:retryable-failure",
		],
		layers: ["integration", "browser"],
		absenceAssertion:
			"No fallback model or runtime, ambient credential, silent wait, fake Run, fake success, or secret disclosure occurs.",
	},
	{
		id: "US-AGENT-PEERS-01",
		ownerFlow: "F08",
		proofTask: "prove-f08-bounded-independent-agent-delegation",
		reusedBy: [],
		selectors: [selector.screenChannelThread, selector.messageRunCard],
		fixtureModeIds: [
			"agent-peers:independent-roots",
			"agent-peers:allowed-child",
			"agent-peers:depth-rejected",
			"agent-peers:fingerprint-rejected",
			"agent-peers:sibling-failure",
			"agent-peers:sibling-cancel",
		],
		layers: ["integration", "browser"],
		absenceAssertion:
			"No merged response, inherited authority, hidden nested SDK call, sibling mutation, or cross-anchor widening occurs.",
	},
	{
		id: "US-COPY-01",
		ownerFlow: "F01",
		proofTask: "prove-f01-human-only-company-bootstrap",
		reusedBy: ["F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10"],
		selectors: [
			...phase0QueryStateCoverage.map((surface) => surface.selector),
			selector.messageRunCard,
		],
		fixtureModeIds: [
			"copy:long-company",
			"copy:long-work",
			"copy:long-actor",
			"copy:long-markdown",
		],
		layers: ["browser"],
		absenceAssertion:
			"No identity, scope, or status truncation, horizontal page scroll, overlapping action, or collapsed field occurs.",
	},
	{
		id: "US-ADAPTIVE-01",
		ownerFlow: "F01",
		proofTask: "prove-f01-human-only-company-bootstrap",
		reusedBy: ["F04"],
		selectors: [selector.screenCompanyHome, selector.screenChannelThread, selector.chatComposer],
		fixtureModeIds: [
			"adaptive:viewport-390",
			"adaptive:viewport-767",
			"adaptive:viewport-768",
			"adaptive:viewport-1023",
			"adaptive:viewport-1024",
			"adaptive:wide",
			"adaptive:keyboard",
			"adaptive:coarse-pointer",
			"adaptive:reduced-motion",
			"adaptive:safe-area",
		],
		layers: ["browser"],
		absenceAssertion:
			"No unreachable control, lost focus, undersized target, clipped overlay, safe-area collision, or motion-only status occurs.",
	},
] as const satisfies readonly StateObligation[];
