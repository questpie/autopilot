# Testing onboarding locally (browser)

How to exercise the full sign-up → e-mail verification → sign-in → company
onboarding flow against your local **dev** database, in a real browser.

## TL;DR

From the repo root:

```bash
bun run preview:db      # one-time (and after schema changes): sync the dev DB — safe, never prod
bun run preview         # build + serve the app on http://localhost:3000 against the dev DB
```

`bun run preview` = `build` + `preview:serve` (`NODE_ENV=production` + the console mail
adapter, reading `apps/operator-web/.env`). After a code change, re-run `bun run preview`
to rebuild; to just restart the server on the existing build, use `bun run preview:serve`.
This replaces `bun dev`, which is currently broken (see below).

Then, in this terminal, watch stdout while you use the app at
<http://localhost:3000>:

1. **Sign up** — "Vytvoriť nový účet", fill Meno / E-mail / Heslo, submit.
2. **Find the verify link** — a block like this prints to the terminal
   (the console mail adapter; `requireEmailVerification` is on, so a real
   Better Auth token link is generated):

   ```
   📧 EMAIL (Console Adapter - Development Mode)
   To: <your email>
   Subject: Overte svoj e-mail — QUESTPIE Autopilot
   Text Content:
   ...
   http://localhost:3000/api/auth/verify-email?token=…&callbackURL=%2F
   ```

3. **Open that link** in the browser → e-mail is verified (302 back to `/`).
4. **Sign in** with the same credentials → the "Vytvorte svoju spoločnosť"
   onboarding (Krok 1 z 4) appears.

Stop the server with Ctrl+C.

## Why the production build and not `bun dev`

`bun dev` (the Vite dev server) currently **fails to serve** in this workspace —
unrelated to onboarding. TanStack Start's `server-fn:ssr` transform tries to load
`defu` (a transitive Better Auth dependency) from the **symlinked framework's**
nested `node_modules/.bun` store with a `?server-fn-module-lookup` query and
throws `Failed to load url … defu.mjs`, so every page 500s. This reproduces on a
clean checkout with none of the onboarding changes applied, so it is a
pre-existing dev-server / linked-framework issue, tracked separately. The
production build (`bun run build` + run `.output/server/index.mjs`) is the same
artifact the scenario harness serves and works end-to-end.

## Notes

- Mail delivery in this app is the **console adapter** (`questpie.config.ts`),
  so no real e-mail is sent — the link only appears in the server terminal.
  Swap the adapter for a real provider before production.
- `requireEmailVerification` stays enforced: signing in before clicking the link
  returns 403. Verification only sets `emailVerified`; it does not auto-sign-in.
- Uses your persistent dev DB, so accounts you create stick around. Remove a test
  user with:
  `psql "$DATABASE_URL" -c "DELETE FROM \"user\" WHERE email='…';"`
