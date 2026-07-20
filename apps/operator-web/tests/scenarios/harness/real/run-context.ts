import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** apps/operator-web (this file lives at tests/scenarios/harness/real/). */
export const appRoot = join(import.meta.dir, "..", "..", "..", "..");

const RAND_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const randomSuffix = (length: number): string => {
	let out = "";
	for (let index = 0; index < length; index += 1) {
		out += RAND_ALPHABET[Math.floor(Math.random() * RAND_ALPHABET.length)];
	}
	return out;
};

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** UTC timestamp as yyyymmddhhmmss (14 digits, sortable, identifier-safe). */
export const formatUtcStamp = (date: Date): string =>
	`${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}${pad2(
		date.getUTCHours(),
	)}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}`;

/** Inverse of formatUtcStamp; returns null when the stamp is not a plausible yyyymmddhhmmss. */
export const parseUtcStamp = (stamp: string): Date | null => {
	if (!/^\d{14}$/.test(stamp)) return null;
	const year = Number(stamp.slice(0, 4));
	const month = Number(stamp.slice(4, 6));
	const day = Number(stamp.slice(6, 8));
	const hour = Number(stamp.slice(8, 10));
	const minute = Number(stamp.slice(10, 12));
	const second = Number(stamp.slice(12, 14));
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	if (hour > 23 || minute > 59 || second > 59) return null;
	return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

export type RunContext = {
	/** `<yyyymmddhhmmss>_<rand6>`, all-lowercase — safe as an unquoted postgres identifier part. */
	runId: string;
	/** Absolute per-run evidence directory: apps/operator-web/tmp/scenario-harness/<runId>/. */
	evidenceDir: string;
	startedAt: Date;
};

export const createRunContext = (now: Date = new Date()): RunContext => {
	const runId = `${formatUtcStamp(now)}_${randomSuffix(6)}`;
	const evidenceDir = join(appRoot, "tmp", "scenario-harness", runId);
	mkdirSync(evidenceDir, { recursive: true });
	return { runId, evidenceDir, startedAt: now };
};
