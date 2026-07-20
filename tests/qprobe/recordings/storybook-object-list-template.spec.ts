import { test, expect } from "@playwright/test";

test("storybook-object-list-template", async ({ page }) => {
	await page.goto(
		"http://127.0.0.1:6007/iframe.html?id=templates-work-objectlist--tasks-populated&viewMode=story",
	);
	await expect(page.getByText("Landing sekcia — hero + prehľad kolekcie")).toBeVisible();
	await page.screenshot({
		path: "tmp/qprobe/sessions/questpie-autopilot-v2-bfc8beb3/shots/shot-002.png",
		fullPage: true,
	});
});
