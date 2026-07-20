import { expect, test } from "@playwright/test";

/**
 * Hand-curated seed recording for the product replay surface.
 *
 * Selector discipline: CSS/data-testid selectors ONLY — `@e` snapshot refs pass
 * through qprobe codegen verbatim and do NOT replay. Future f01-*..f10-* specs
 * must use the stable data-testid vocabulary from
 * apps/operator-web/tests/scenarios/phase-0/contracts.ts.
 *
 * Replays against a scenario-harness server (per-run random port):
 *   qprobe replay harness-smoke --base http://localhost:<port> --browser chromium
 */
test("harness-smoke", async ({ page }) => {
	// Anonymous "/" now redirects to the sign-in entry (truth-derived resolver).
	await page.goto("/");
	await expect(page.locator('[data-testid="screen-sign-in"]')).toBeVisible();

	const health = await page.request.get("/api/health");
	expect(health.status()).toBe(200);
	const body = (await health.json()) as { checks?: { database?: { status?: string } } };
	expect(body.checks?.database?.status).toBe("ok");
});
