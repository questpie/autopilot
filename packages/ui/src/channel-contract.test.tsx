import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
	ChannelThread,
	type ChannelMessagePart,
	type ChannelThreadProjection,
	RunDetail,
	type RunDetailProjection,
} from "./components/ai";

const autopilot = { id: "autopilot", name: "Autopilot", kind: "agent" as const };
const marek = { id: "marek", name: "Marek H.", kind: "human" as const };

const run = {
	id: "run-01",
	actor: autopilot,
	state: {
		kind: "live" as const,
		phase: "working" as const,
		phaseLabel: "Pracuje",
		currentAction: "Pripravuje návrh ponuky",
	},
	elapsed: "2 min",
	activity: "Použil 4 nástroje · naposledy prehľadal Znalosti",
	hiddenActivityCount: 5,
};

describe("authored Channel and Run presentation contracts", () => {
	it("keeps projection data closed and sends behavior through one action seam", () => {
		const toolSummary = {
			id: "tools-01",
			kind: "tool-summary",
			count: 7,
			latest: "Pripravil návrh newslettera",
		} satisfies ChannelMessagePart;
		const projection = {
			title: "# general",
			vessel: { kind: "channel", channelId: "general", spaceId: "company-root" },
			content: {
				kind: "ready",
				messages: [
					{
						id: "m1",
						actor: marek,
						authoredAt: { iso: "2026-07-19T09:41:00+02:00", label: "09:41" },
						parts: [
							{ id: "copy-01", kind: "markdown", markdown: "Ahoj **Autopilot**." },
							toolSummary,
						],
					},
				],
			},
			composer: {
				mode: "channel",
				draft: { text: "", clientNonce: "draft-01", mentions: [], attachments: [] },
				state: "ready",
			},
		} satisfies ChannelThreadProjection;

		expect("onSubmit" in projection.composer).toBe(false);
		const markup = renderToStaticMarkup(
			<ChannelThread projection={projection} onAction={() => undefined} />,
		);

		expect(markup).toContain('data-content-state="ready"');
		expect(markup).toContain('data-slot="message-part-tool-summary"');
		expect(markup).toContain("Marek H.");
		expect(markup).not.toContain('data-slot="bubble"');
		expect(markup).not.toContain("Operátor");
	});

	it("renders typed Run detail without arbitrary content or Phase-0 steering", () => {
		const projection = {
			run: {
				...run,
				state: {
					kind: "completed",
					recap: {
						summary: "Návrh je pripravený na kontrolu.",
						items: [
							{
								id: "evidence-01",
								kind: "evidence",
								label: "Cenník leto 2026",
								referenceId: "knowledge-price-list-01",
								actor: autopilot,
								occurredAt: "09:42",
								detail: "Použitý ako podklad pre návrh",
							},
						],
					},
				},
			},
			groups: [
				{
					id: "g1",
					label: "Prehľadal Znalosti",
					count: 4,
					latest: "Našiel cenník leto 2026",
					time: "09:42",
				},
			],
			permissions: [],
			attempts: [{ id: "a1", label: "Pokus 1", status: "completed", startedAt: "09:41" }],
		} satisfies RunDetailProjection;

		const markup = renderToStaticMarkup(
			<RunDetail projection={projection} onAction={() => undefined} />,
		);

		expect(markup).toContain("Cenník leto 2026");
		expect(markup).toContain("knowledge-price-list-01");
		expect(markup).toContain("Pokusy");
		expect(markup).not.toContain("Riadenie");
	});
});
