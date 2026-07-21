import { describe, expect, test } from "bun:test";
import type { QueryKey } from "@tanstack/react-query";

import {
	buildOptimisticHandlers,
	type PlainQueryKey,
	plainQueryKey,
	type UseOptimisticMutationConfig,
} from "@/lib/data/use-optimistic-mutation";
import { createAppQueryClient } from "@/lib/query-client";

// A minimal directory-style row: persisted rows carry {id,name}; the pending marker
// additionally carries the clientNonce the reconcile matches on (nonce -> real id).
type DirectoryRow = { id: string; name: string; clientNonce?: string; pending?: boolean };
type CreateVars = { name: string };
type CreateReceipt = { id: string; name: string };

// A DERIVED/ephemeral key (there is no realtime form of it), branded plain — the
// only kind of key this hook accepts. A live arm's key could not reach here without
// a visibly dishonest plainQueryKey() cast (see the compile-time guard below).
const TARGET = plainQueryKey<readonly DirectoryRow[]>([
	"autopilot-v2",
	"spaces",
	"optimistic",
	"company-hreben",
]);

function makeConfig(
	overrides?: Partial<UseOptimisticMutationConfig<CreateVars, CreateReceipt, DirectoryRow>>,
): UseOptimisticMutationConfig<CreateVars, CreateReceipt, DirectoryRow> {
	return {
		target: TARGET,
		mutation: { mutationFn: async (vars: CreateVars) => ({ id: "space-real", name: vars.name }) },
		toPendingRow: (vars, clientNonce) => ({
			id: clientNonce,
			name: vars.name,
			clientNonce,
			pending: true,
		}),
		reconcile: (persisted) => ({ id: persisted.id, name: persisted.name }),
		mintNonce: () => "nonce-1",
		...overrides,
	};
}

describe("use-optimistic-mutation: acknowledgement-only optimism on a plain/derived key (ADR 0022)", () => {
	test("onMutate inserts a pending marker carrying the clientNonce, appended to the target", async () => {
		const queryClient = createAppQueryClient();
		const initial: DirectoryRow[] = [{ id: "space-cela", name: "Celá spoločnosť" }];
		queryClient.setQueryData(TARGET, initial);

		const handlers = buildOptimisticHandlers(queryClient, makeConfig());
		const context = await handlers.onMutate({ name: "Marketing" });

		// The context carries ONLY the nonce — the identity rollback and reconcile act on.
		expect(context.clientNonce).toBe("nonce-1");

		// The target now holds the original rows plus ONE pending marker with the nonce.
		const rows = queryClient.getQueryData<DirectoryRow[]>(TARGET);
		expect(rows).toHaveLength(2);
		expect(rows?.find((row) => row.clientNonce === "nonce-1")).toEqual({
			id: "nonce-1",
			name: "Marketing",
			clientNonce: "nonce-1",
			pending: true,
		});
	});

	test("onError drops this mutation's marker, restoring the prior rows", async () => {
		const queryClient = createAppQueryClient();
		const initial: DirectoryRow[] = [{ id: "space-cela", name: "Celá spoločnosť" }];
		queryClient.setQueryData(TARGET, initial);

		const handlers = buildOptimisticHandlers(queryClient, makeConfig());
		const context = await handlers.onMutate({ name: "Marketing" });
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toHaveLength(2);

		handlers.onError(new Error("transport down"), { name: "Marketing" }, context);
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toEqual(initial);
	});

	test("onError with no prior entry removes the optimistic entry entirely", async () => {
		const queryClient = createAppQueryClient();
		// No setQueryData: the target starts empty (undefined), like a fresh ephemeral key.
		const handlers = buildOptimisticHandlers(queryClient, makeConfig());
		const context = await handlers.onMutate({ name: "Marketing" });
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toHaveLength(1);

		handlers.onError(new Error("transport down"), { name: "Marketing" }, context);
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toBeUndefined();
	});

	test("onSuccess reconciles by clientNonce identity: pending -> persisted, other rows untouched", async () => {
		const queryClient = createAppQueryClient();
		const existing: DirectoryRow = { id: "space-cela", name: "Celá spoločnosť" };
		queryClient.setQueryData(TARGET, [existing]);

		const handlers = buildOptimisticHandlers(queryClient, makeConfig());
		const context = await handlers.onMutate({ name: "Marketing" });

		handlers.onSuccess({ id: "space-real", name: "Marketing" }, { name: "Marketing" }, context);

		const rows = queryClient.getQueryData<DirectoryRow[]>(TARGET);
		expect(rows).toEqual([existing, { id: "space-real", name: "Marketing" }]);
		// The untouched row keeps its exact reference; only the marker was swapped.
		expect(rows?.[0]).toBe(existing);
		// No pending marker / clientNonce survives the reconcile.
		expect(rows?.some((row) => row.clientNonce !== undefined)).toBe(false);
	});

	test("concurrent mutations on one key: an error drops only its own marker, the other survives", async () => {
		const queryClient = createAppQueryClient();
		const existing: DirectoryRow = { id: "space-cela", name: "Celá spoločnosť" };
		queryClient.setQueryData(TARGET, [existing]);

		const handlersA = buildOptimisticHandlers(
			queryClient,
			makeConfig({ mintNonce: () => "nonce-a" }),
		);
		const handlersB = buildOptimisticHandlers(
			queryClient,
			makeConfig({ mintNonce: () => "nonce-b" }),
		);

		// Both mutations start and insert their markers (A then B, overlapping).
		const ctxA = await handlersA.onMutate({ name: "Alpha" });
		const ctxB = await handlersB.onMutate({ name: "Beta" });
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toHaveLength(3);

		// A fails: its per-nonce rollback must NOT clobber B's still-pending marker.
		handlersA.onError(new Error("A down"), { name: "Alpha" }, ctxA);
		const afterA = queryClient.getQueryData<DirectoryRow[]>(TARGET);
		expect(afterA).toHaveLength(2);
		expect(afterA?.some((row) => row.clientNonce === "nonce-b")).toBe(true);
		expect(afterA?.some((row) => row.clientNonce === "nonce-a")).toBe(false);

		// B then succeeds and reconciles to its persisted row — never lost by A's rollback.
		handlersB.onSuccess({ id: "space-beta", name: "Beta" }, { name: "Beta" }, ctxB);
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toEqual([
			existing,
			{ id: "space-beta", name: "Beta" },
		]);
	});

	test("onSuccess appends the persisted row when its marker was already dropped (no silent loss)", async () => {
		const queryClient = createAppQueryClient();
		const existing: DirectoryRow = { id: "space-cela", name: "Celá spoločnosť" };
		queryClient.setQueryData(TARGET, [existing]);

		const handlers = buildOptimisticHandlers(queryClient, makeConfig());
		const context = await handlers.onMutate({ name: "Marketing" });
		// A mid-flight truth refetch dropped the pending marker before the ack arrived.
		queryClient.setQueryData<readonly DirectoryRow[]>(TARGET, [existing]);

		handlers.onSuccess({ id: "space-real", name: "Marketing" }, { name: "Marketing" }, context);
		// The acknowledged row is appended, not silently lost.
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toEqual([
			existing,
			{ id: "space-real", name: "Marketing" },
		]);
	});

	test("without a reconcile mapper, settle invalidates the derived target instead of swapping", async () => {
		const queryClient = createAppQueryClient();
		queryClient.setQueryData(TARGET, [{ id: "space-cela", name: "Celá spoločnosť" }]);
		const handlers = buildOptimisticHandlers(queryClient, makeConfig({ reconcile: undefined }));
		const context = await handlers.onMutate({ name: "Marketing" });

		// No mapper -> onSuccess leaves the marker; canonical truth arrives via invalidate.
		handlers.onSuccess({ id: "space-real", name: "Marketing" }, { name: "Marketing" }, context);
		expect(queryClient.getQueryData<DirectoryRow[]>(TARGET)).toHaveLength(2);

		// onSettled returns the invalidation promise so the mutation stays pending until it settles.
		await handlers.onSettled();
		const entry = queryClient.getQueryCache().find({ queryKey: TARGET, exact: true });
		expect(entry?.state.isInvalidated).toBe(true);
	});

	test("compile-time guard: the hook targets a plain/derived key, never a live arm", () => {
		// Pure type-level proof (checked by `tsc`, exercised trivially at runtime): a
		// live arm exposes a bare `QueryKey` (e.g. `queries.spaces.visibleLive(id).queryKey`),
		// which is NOT assignable to the hook's `PlainQueryKey<...>` target — so a caller
		// cannot point the optimistic hook at a {realtime:true} arm without a visibly
		// dishonest `plainQueryKey()` cast. If the brand regresses to a plain QueryKey,
		// `_RawLiveKeyIsNotAcceptable` collapses to `false` and this file fails to compile.
		type Assert<T extends true> = T;
		type IsAssignable<A, B> = [A] extends [B] ? true : false;
		type _RawLiveKeyIsNotAcceptable = Assert<
			IsAssignable<QueryKey, PlainQueryKey<readonly DirectoryRow[]>> extends true ? false : true
		>;
		type _BrandedPlainKeyIsAcceptable = Assert<
			IsAssignable<PlainQueryKey<readonly DirectoryRow[]>, QueryKey>
		>;

		const guards: [_RawLiveKeyIsNotAcceptable, _BrandedPlainKeyIsAcceptable] = [true, true];
		expect(guards).toEqual([true, true]);
		// And branding a derived/ephemeral key is the sanctioned, passthrough path.
		expect(plainQueryKey<readonly DirectoryRow[]>(["spaces", "optimistic"])).toEqual([
			"spaces",
			"optimistic",
		]);
	});
});
