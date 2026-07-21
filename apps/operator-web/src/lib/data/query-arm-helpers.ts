import type { EnsureQueryDataOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

/**
 * Feature-agnostic helpers shared by every `features/<name>/queries.ts` factory
 * (ADR 0023). These carry no feature knowledge — a per-feature arm module imports
 * the identity bridge and the drift guards from here so the query factories can be
 * split out of the old monolithic `feature-queries.ts` without duplication.
 */

/** Structural check for the typed client's access-denied error (403). */
export const isAccessDenied = (error: unknown): boolean =>
	error instanceof Error && "status" in error && error.status === 403;

/**
 * The framework's INFERRED find-result data type for a collection read. `find`
 * returns the copy of @tanstack/react-query nested under @questpie/tanstack-query
 * (see the identity note on `asAppQueryOptions`), but `FindResult` is a
 * questpie-core type, so the shape recovered here through `queryFn` is
 * react-query-version-independent — the real, schema-derived read result.
 */
export type FindResultOf<TFind extends (...args: never[]) => unknown> =
	ReturnType<TFind> extends {
		queryFn?: infer QF;
	}
		? Extract<QF, (...args: never[]) => unknown> extends (...args: never[]) => infer TResult
			? Awaited<TResult>
			: never
		: never;

/** Compile error unless `T` is assignable to `U`; resolves to `T` otherwise. */
export type AssertExtends<T extends U, U> = T;

/**
 * Identity bridge for the workspace's duplicated @tanstack/react-query copies:
 * the app's copy and the one nested under @questpie/tanstack-query resolve as two
 * structurally identical but NOMINALLY distinct Query classes (see
 * lib/data/session.ts), so tsc rejects the option objects `find` returns against
 * the app's copy. This is the ONE place that re-types those objects against the
 * app copy. It bridges IDENTITY ONLY — it does not re-shape the data: the raw arms
 * narrow via their `Snapshot` return annotations, whose fidelity to the real
 * schema is pinned by the `FindResultOf` assertions at each arm. This replaces the
 * per-arm `as unknown as ...<Snapshot>` double-casts, which conflated the
 * (unavoidable, checked-elsewhere) identity concern with an unchecked data re-type.
 */
export function asAppQueryOptions<TData>(options: {
	queryKey?: readonly unknown[];
}): EnsureQueryDataOptions<TData> & UseSuspenseQueryOptions<TData> {
	return options as unknown as EnsureQueryDataOptions<TData> & UseSuspenseQueryOptions<TData>;
}
