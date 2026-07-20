import { expect, test } from "@playwright/test";

/**
 * F01 canonical product replay — the PUBLIC deterministic leg of
 * UC-P0-001 bootstrap-human-only-company, driven with a real browser against a
 * scenario-harness server (disposable Postgres, per-run random port).
 *
 * Scope: anonymous surface only. The AUTHENTICATED legs (bootstrap, resume,
 * team roster, AI skip, /app home) stay in the flow test
 * (apps/operator-web/tests/scenarios/phase-0/flows/f01-bootstrap-human-only-company.flow.test.ts)
 * — replay cannot cross the email-verification wall (requireEmailVerification is
 * on and no verification sender is wired; the emailVerified flip is a test-only
 * SQL seam). Signing up a RUNTIME-UNIQUE address keeps every replay green against
 * the same disposable DB, not only against a fresh one.
 *
 * Selector discipline (see tests/qprobe-product/README.md): CSS / data-testid
 * selectors only — no `@e` snapshot refs, no absolute origins. `page.goto("/")`
 * rides the per-run `--base`. The stable data-testid vocabulary comes from
 * apps/operator-web/tests/scenarios/phase-0/contracts.ts (screen-sign-in).
 *
 *   qprobe replay f01-bootstrap-human-only-company --base http://localhost:<port> --browser chromium
 */
test("f01-bootstrap-human-only-company", async ({ page }) => {
	// 1) Anonymous "/" resolves to the sign-in entry (truth-derived resolver).
	await page.goto("/");
	await expect(page).toHaveURL(/\/sign-in$/);
	await expect(page.locator('[data-testid="screen-sign-in"]')).toBeVisible();

	// 2) Invalid credentials surface the inline error AND preserve the typed input.
	await page.locator("#sign-in-email").fill("neznamy@harness.invalid");
	await page.locator("#sign-in-password").fill("zle-heslo-123456");
	await page.locator('[data-slot="auth-shell-frame"] button[type="submit"]').click();
	await expect(page.locator('[data-slot="auth-shell-state"]')).toContainText("Prihlásenie zlyhalo");
	await expect(page.locator("#sign-in-email")).toHaveValue("neznamy@harness.invalid");

	// 3) Sign-up with a runtime-unique address reaches the HONEST verification-
	//    pending state — the app never claims a verification e-mail was sent.
	const uniqueEmail = `probe-${Date.now()}@harness.invalid`;
	await page.locator('[data-slot="auth-shell-frame"] button[type="button"]').click();
	await expect(page.locator("#sign-in-name")).toBeVisible();
	await page.locator("#sign-in-name").fill("Marek Probe");
	await page.locator("#sign-in-email").fill(uniqueEmail);
	await page.locator("#sign-in-password").fill("Heslo-Probe-123456");
	await page.locator('[data-slot="auth-shell-frame"] button[type="submit"]').click();
	await expect(page.locator('[data-testid="screen-sign-in"]')).toContainText("Overte svoj e-mail");

	// 4) Anonymous deep link into the app redirects back to sign-in WITHOUT a loop.
	await page.goto("/app/hreben/home");
	await expect(page).toHaveURL(/\/sign-in\?redirect=/);
	await expect(page.locator('[data-testid="screen-sign-in"]')).toBeVisible();
});
