import { describe, expect, test } from "bun:test";

import verifyEmail from "@/questpie/server/emails/verify-email";

// The handler only reads `input` — AppContext services play no part in
// rendering — so a minimal args object exercises it faithfully.
const render = (input: { verifyUrl: string; name: string }) =>
	verifyEmail.handler({ input } as Parameters<typeof verifyEmail.handler>[0]);

const VERIFY_URL =
	"https://operator.example.test/api/auth/verify-email?token=abc123&callbackURL=%2F";

describe("verify-email template", () => {
	test("subject is the Slovak verification subject", async () => {
		const { subject } = await render({ verifyUrl: VERIFY_URL, name: "Marek" });
		expect(subject).toBe("Overte svoj e-mail — QUESTPIE Autopilot");
	});

	test("verify link appears in BOTH the html and the plain-text body", async () => {
		const { html, text } = await render({ verifyUrl: VERIFY_URL, name: "Marek" });
		// In the html the `&` query separators are entity-escaped (`&amp;`) — the
		// HTML-correct form; a client decodes them back to `&` on click.
		const escapedUrl = VERIFY_URL.replace(/&/g, "&amp;");
		expect(html).toContain(`href="${escapedUrl}"`);
		// The plain-text body is what the dev ConsoleAdapter logs; the raw link
		// (unescaped) MUST be present there or the human-testable onboarding path
		// breaks — a `&amp;` pasted into a browser would corrupt the token query.
		expect(text).toContain(VERIFY_URL);
	});

	test("an untrusted display name is HTML-escaped (no markup injection)", async () => {
		const { html } = await render({
			verifyUrl: VERIFY_URL,
			name: "<script>alert(1)</script>",
		});
		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;");
	});

	test("a crafted verify URL cannot break out of the href attribute", async () => {
		const crafted = 'https://evil.example/"><img src=x onerror=alert(1)>';
		const { html } = await render({ verifyUrl: crafted, name: "Marek" });
		expect(html).not.toContain('"><img');
		expect(html).toContain("&quot;&gt;");
	});
});
