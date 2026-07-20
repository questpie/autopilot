/**
 * Queue-drain entrypoint — the ONLY harness file allowed to import #questpie /
 * src/questpie/server/.generated (enforced by harness-guards guard (c)). It runs
 * in its own short-lived process, spawned by server-process drainQueue() with an
 * allowlist env {PATH, HOME, DATABASE_URL:<disposable>}, so the app's module
 * globals never enter the harness test process. Every other app env var has a
 * schema default (see src/lib/env.ts) — DATABASE_URL alone drives the app.
 */
import { app, createContext } from "../../../../src/questpie/server/.generated/index.ts";

const ctx = await createContext({ accessMode: "system" });
// QueueService.runOnce processes one bounded batch (PgBossAdapter declares
// runOnceConsumer: true and returns { processed: 0 } when nothing is queued),
// so published jobs sit until this lever drains them — queue determinism by
// construction plus an explicit drain.
await ctx.queue.runOnce();
await app.destroy();
process.exit(0);
