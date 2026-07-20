/**
 * Company draft + command logic for the onboarding wizard (SPEC 10.2).
 * Pure by construction — the transport is injected, so tests never network.
 */

/** Wizard draft: what Marek has typed, nothing more. */
export type CompanyBootstrapDraft = { name: string };

/** What the bootstrap route receives (command envelope + payload). */
export type CompanyBootstrapSubmission = { idempotencyKey: string; name: string };

/** SPEC 10.2 recoverable-error contract: retry offered, draft kept intact. */
export const BOOTSTRAP_RECOVERABLE_MESSAGE =
	"Spoločnosť sa nepodarilo vytvoriť. Skúste to znova — zadané údaje zostali zachované.";

export type MintKey = () => string;

const defaultMintKey: MintKey = () => `companies-bootstrap-${crypto.randomUUID()}`;

const draftFingerprint = (draft: CompanyBootstrapDraft): string => draft.name.trim();

/**
 * Draft-stable idempotency keys: the same draft (after trimming) always
 * reuses its first minted key — retrying an unchanged draft after a
 * recoverable failure replays the server receipt instead of creating a
 * second company. An edited draft is a new command and mints a fresh key;
 * returning to an earlier draft returns its original key.
 */
export function createIdempotencyKeyRegistry(mintKey: MintKey = defaultMintKey) {
	const keys = new Map<string, string>();
	return {
		keyFor(draft: CompanyBootstrapDraft): string {
			const fingerprint = draftFingerprint(draft);
			const existing = keys.get(fingerprint);
			if (existing) return existing;
			const minted = mintKey();
			keys.set(fingerprint, minted);
			return minted;
		},
	};
}

export type CompanyBootstrapOutcome<TReceipt> =
	| { status: "created"; receipt: TReceipt }
	| { status: "recoverable"; message: string };

type CompaniesTransport<TReceipt> = {
	bootstrap: (submission: CompanyBootstrapSubmission) => Promise<TReceipt>;
};

/**
 * Company commands over an injected transport (the typed client in the app,
 * a fake in tests). Every failure maps to the Slovak recoverable state —
 * validation happens client-side before submit, the guard owns auth, and the
 * stable key makes each retry replay-safe.
 */
export function createCompaniesCommands<TReceipt>(transport: CompaniesTransport<TReceipt>) {
	const bootstrapKeys = createIdempotencyKeyRegistry();
	return {
		async bootstrap(draft: CompanyBootstrapDraft): Promise<CompanyBootstrapOutcome<TReceipt>> {
			const submission: CompanyBootstrapSubmission = {
				idempotencyKey: bootstrapKeys.keyFor(draft),
				name: draft.name.trim(),
			};
			try {
				return { status: "created", receipt: await transport.bootstrap(submission) };
			} catch {
				return { status: "recoverable", message: BOOTSTRAP_RECOVERABLE_MESSAGE };
			}
		},
	};
}

export type CompaniesCommands<TReceipt> = ReturnType<typeof createCompaniesCommands<TReceipt>>;

/**
 * Client-side preview of the server's slug format (domain slugify without the
 * uniqueness suffix): the server appends a random suffix and stays the only
 * authority on the final slug. Returns "" for slug-incompatible input instead
 * of throwing — the form shows a placeholder until the name yields a slug.
 */
export function previewCompanySlug(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("en-US")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 120);
}
