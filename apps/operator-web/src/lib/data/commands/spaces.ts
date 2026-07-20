/**
 * Space-create command for the shell's create surface (SPEC 10.3). Pure by
 * construction — the transport is injected, so tests never network. Draft-stable
 * idempotency keys make each retry after a recoverable failure replay-safe.
 */

export type SpaceCreateDraft = { name: string };

export type SpaceCreateSubmission = { idempotencyKey: string; companyId: string; name: string };

/** SPEC 10.3 recoverable-error contract: retry offered, the name kept intact. */
export const SPACE_CREATE_RECOVERABLE_MESSAGE =
	"Priestor sa nepodarilo vytvoriť. Skúste to znova — zadaný názov zostal zachovaný.";

export type MintKey = () => string;

const defaultMintKey: MintKey = () => `spaces-create-${crypto.randomUUID()}`;

const createKeyRegistry = (mintKey: MintKey) => {
	const keys = new Map<string, string>();
	return (fingerprint: string): string => {
		const existing = keys.get(fingerprint);
		if (existing) return existing;
		const minted = mintKey();
		keys.set(fingerprint, minted);
		return minted;
	};
};

type SpacesTransport<TReceipt> = {
	create: (submission: SpaceCreateSubmission) => Promise<TReceipt>;
};

export type SpaceCreateOutcome<TReceipt> =
	| { status: "created"; receipt: TReceipt }
	| { status: "recoverable"; message: string };

/**
 * Space commands over an injected transport. Keyed by company + trimmed name,
 * so retrying the same draft replays the server receipt instead of creating a
 * duplicate space; an edited name is a fresh command.
 */
export function createSpacesCommands<TReceipt>(
	transport: SpacesTransport<TReceipt>,
	mintKey: MintKey = defaultMintKey,
) {
	const keyFor = createKeyRegistry(mintKey);
	return {
		async create(
			companyId: string,
			draft: SpaceCreateDraft,
		): Promise<SpaceCreateOutcome<TReceipt>> {
			const name = draft.name.trim();
			try {
				const receipt = await transport.create({
					idempotencyKey: keyFor(`${companyId}:${name}`),
					companyId,
					name,
				});
				return { status: "created", receipt };
			} catch {
				return { status: "recoverable", message: SPACE_CREATE_RECOVERABLE_MESSAGE };
			}
		},
	};
}

export type SpacesCommands<TReceipt> = ReturnType<typeof createSpacesCommands<TReceipt>>;
