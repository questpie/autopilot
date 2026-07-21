import {
	type DefaultError,
	type QueryClient,
	type QueryKey,
	useMutation,
	type UseMutationOptions,
	type UseMutationResult,
	useQueryClient,
} from "@tanstack/react-query";

/**
 * Acknowledgement-only optimistic mutations (ADR 0022).
 *
 * The ADR is explicit: a `{realtime:true}` live arm's full-snapshot **replace**
 * reducer overwrites any `onMutate` patch on the very next server snapshot, so a
 * live list takes NO `onMutate` and reconciles the persisted row by identity when
 * its snapshot arrives. Optimism therefore applies ONLY to a plain or derived
 * query — a directory projection or a dedicated ephemeral list key — never a live
 * arm. This hook exists to make that the ONLY thing you can express: it inserts a
 * minimal PENDING marker, rolls back on error, and reconciles the persisted row by
 * `clientNonce` identity, firing exactly ONE route mutation and fabricating no
 * cross-entity state.
 *
 * The plain/derived-only rule is enforced by the {@link PlainQueryKey} brand on
 * `target`: a live arm exposes a bare `QueryKey`, which is NOT assignable to the
 * brand, so pointing the hook at a live arm requires a visibly dishonest
 * {@link plainQueryKey} cast. Because a plain arm and its live twin share ONE key
 * (the framework omits the realtime config from the key), no key can distinguish
 * them structurally — so `plainQueryKey` should only ever brand a projection or an
 * ephemeral key that has no realtime form at all.
 */

declare const PLAIN_QUERY_BRAND: unique symbol;

/**
 * A query key the caller VOUCHES points at a plain or derived cache entry — never
 * a `{realtime:true}` live arm. Mint one with {@link plainQueryKey} from a derived
 * projection key (e.g. `keys.spaces.directory(id)`) or a dedicated ephemeral key.
 */
export type PlainQueryKey<TData> = QueryKey & {
	readonly [PLAIN_QUERY_BRAND]: TData;
};

/**
 * Brand a raw key as plain/derived. This is the one place the plain-only promise
 * is asserted, so it reads as a deliberate vouch at the call site — never reach
 * for it to silence the guard on a live arm.
 */
export function plainQueryKey<TData>(key: QueryKey): PlainQueryKey<TData> {
	return key as PlainQueryKey<TData>;
}

/** The nonce every pending marker carries so its persisted row reconciles by identity. */
export type OptimisticPending = { readonly clientNonce: string };

/**
 * onMutate's return, threaded to onError (per-nonce rollback) and onSuccess
 * (reconcile). Only the `clientNonce` is carried: rollback and reconcile both act
 * on THIS mutation's marker alone, so a concurrent mutation on the same key is
 * never clobbered and a mid-flight truth refetch is never overwritten.
 */
export type OptimisticContext = {
	readonly clientNonce: string;
};

/**
 * The framework mutation seam (`q.routes.*.mutation()` / `q.custom.mutation`),
 * minus its lifecycle callbacks — this hook OWNS the optimistic lifecycle, so a
 * caller cannot smuggle a competing `onMutate`/`onSuccess` past the acknowledgement
 * contract. Exactly one route mutation feeds the hook; it fires nothing else.
 */
export type RouteMutationOptions<TVariables, TData> = Omit<
	UseMutationOptions<TData, DefaultError, TVariables>,
	"onMutate" | "onError" | "onSuccess" | "onSettled"
>;

export type UseOptimisticMutationConfig<TVariables, TData, TRow extends object> = {
	/** The plain/derived list this optimism acts on. NEVER a live arm — see the brand. */
	target: PlainQueryKey<readonly TRow[]>;
	/** Exactly one route mutation (the framework seam); its result reconciles the marker. */
	mutation: RouteMutationOptions<TVariables, TData>;
	/** Build the minimal pending marker; it MUST carry the `clientNonce` for reconcile. */
	toPendingRow: (variables: TVariables, clientNonce: string) => TRow & OptimisticPending;
	/**
	 * Reconcile-by-identity: map the persisted result onto the row that replaces the
	 * pending marker (matched by `clientNonce`). Omit to instead invalidate the target
	 * on settle — correct when it is a derived read whose truth refetch drops the marker.
	 */
	reconcile?: (persisted: TData, variables: TVariables, clientNonce: string) => TRow;
	/** Nonce minter; injected deterministically in tests. */
	mintNonce?: () => string;
};

/** The four lifecycle handlers, concretely typed so callers/tests read the context exactly. */
export type OptimisticHandlers<TVariables, TData> = {
	onMutate: (variables: TVariables) => Promise<OptimisticContext>;
	onError: (
		error: DefaultError,
		variables: TVariables,
		context: OptimisticContext | undefined,
	) => void;
	onSuccess: (data: TData, variables: TVariables, context: OptimisticContext) => void;
	onSettled: () => Promise<void> | void;
};

const defaultMintNonce = (): string => `optimistic-${crypto.randomUUID()}`;

/** Read a row's `clientNonce` if it carries one — persisted rows return `undefined`. */
const readClientNonce = (row: unknown): string | undefined =>
	row && typeof row === "object" && "clientNonce" in row
		? ((row as { clientNonce?: unknown }).clientNonce as string | undefined)
		: undefined;

/**
 * The optimistic lifecycle as plain functions over a real QueryClient — no React —
 * so the acknowledgement contract is unit-testable directly. {@link useOptimisticMutation}
 * is the thin hook that wires these into `useMutation`.
 */
export function buildOptimisticHandlers<TVariables, TData, TRow extends object>(
	queryClient: QueryClient,
	config: UseOptimisticMutationConfig<TVariables, TData, TRow>,
): OptimisticHandlers<TVariables, TData> {
	const mintNonce = config.mintNonce ?? defaultMintNonce;
	// The target is a factory-derived, branded PlainQueryKey — never a handwritten
	// array — so bind it once and forward it to the QueryClient by shorthand. (The
	// framework-boundary lint reserves inline query-key object literals for the
	// generated key factory; this hook only forwards an already-typed key.)
	const queryKey = config.target;

	return {
		async onMutate(variables) {
			const clientNonce = mintNonce();
			// Cancel in-flight refetches so a settling read can't clobber the marker.
			await queryClient.cancelQueries({ queryKey, exact: true });
			const pendingRow = config.toPendingRow(variables, clientNonce);
			queryClient.setQueryData<readonly TRow[]>(queryKey, (current) => [
				...(current ?? []),
				pendingRow,
			]);
			return { clientNonce };
		},
		onError(_error, _variables, context) {
			if (!context) return;
			// Per-nonce rollback: drop ONLY this mutation's marker from the CURRENT list,
			// so a concurrent mutation's marker and any fresher server data (a truth
			// refetch that settled mid-flight) both survive. If nothing is left, remove
			// the entry so the key returns to `undefined` — the exact empty-start state.
			const current = queryClient.getQueryData<readonly TRow[]>(queryKey);
			const next = (current ?? []).filter((row) => readClientNonce(row) !== context.clientNonce);
			if (next.length > 0) {
				queryClient.setQueryData<readonly TRow[]>(queryKey, next);
			} else {
				queryClient.removeQueries({ queryKey, exact: true });
			}
		},
		onSuccess(data, variables, context) {
			if (!config.reconcile) return;
			const reconciled = config.reconcile(data, variables, context.clientNonce);
			// Reconcile by identity: swap the marker (matched by clientNonce) for the
			// persisted row. If the marker is already gone (a mid-flight truth refetch
			// dropped it), APPEND the row so the acknowledged create is never silently
			// lost. Untouched rows keep their references.
			queryClient.setQueryData<readonly TRow[]>(queryKey, (current) => {
				const list = current ?? [];
				let matched = false;
				const swapped = list.map((row) => {
					if (readClientNonce(row) !== context.clientNonce) return row;
					matched = true;
					return reconciled;
				});
				return matched ? swapped : [...swapped, reconciled];
			});
		},
		onSettled() {
			// No reconcile mapper -> the target is a derived read; pull canonical truth,
			// which naturally drops the marker. Return the promise so the mutation stays
			// pending until the refetch settles (the documented TanStack pattern). With a
			// mapper the swap is already done, so there is nothing to invalidate.
			if (config.reconcile) return;
			return queryClient.invalidateQueries({ queryKey, exact: true });
		},
	};
}

/**
 * Acknowledgement-only optimistic mutation on a plain/derived list (ADR 0022).
 * Fires exactly one route mutation; inserts a pending marker on mutate, rolls back
 * on error, reconciles the persisted row by `clientNonce` identity on success.
 */
export function useOptimisticMutation<TVariables, TData, TRow extends object>(
	config: UseOptimisticMutationConfig<TVariables, TData, TRow>,
): UseMutationResult<TData, DefaultError, TVariables, OptimisticContext> {
	const queryClient = useQueryClient();
	return useMutation<TData, DefaultError, TVariables, OptimisticContext>({
		...config.mutation,
		...buildOptimisticHandlers(queryClient, config),
	});
}
