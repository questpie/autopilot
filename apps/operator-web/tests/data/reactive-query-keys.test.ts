import { describe, expect, test } from "bun:test";

import { createAppClient } from "@/lib/client";
import { createFeatureQueries } from "@/lib/data/feature-queries";
import { createQueryKeys } from "@/lib/data/query-keys";
import { createSessionQuery } from "@/lib/data/session";
import { createAppQueryOptions } from "@/lib/query";

const BASE_URL = "https://operator.example.test";
const q = createAppQueryOptions(createAppClient({ baseURL: BASE_URL }));
const queries = createFeatureQueries(q);
const keys = createQueryKeys(q);

/** ["autopilot-v2", ...] — the configured keyPrefix (lib/query.ts). */
const PREFIX = ["autopilot-v2"] as const;

describe("static/live arms share ONE cache key (SSR static-load -> stream-upgrade)", () => {
	test("spaces.visible and spaces.visibleLive queryKeys are deep-equal", () => {
		const plain = queries.spaces.visible("company-hreben");
		const live = queries.spaces.visibleLive("company-hreben");
		// The framework computes the key before the realtime branch and never puts
		// the {realtime} config in the key — identical options => identical key.
		expect(live.queryKey).toEqual(plain.queryKey);
	});

	test("actors.agents and actors.agentsLive queryKeys are deep-equal", () => {
		const plain = queries.actors.agents("company-hreben");
		const live = queries.actors.agentsLive("company-hreben");
		expect(live.queryKey).toEqual(plain.queryKey);
	});

	test("channels.visible and channels.visibleLive queryKeys are deep-equal (space-scoped)", () => {
		const plain = queries.channels.visible("space-cela");
		const live = queries.channels.visibleLive("space-cela");
		// Same invariant as spaces, keyed by spaceId: identical options => identical key.
		expect(live.queryKey).toEqual(plain.queryKey);
	});
	test("projects.visible and projects.visibleLive queryKeys are deep-equal (space-scoped)", () => {
		const plain = queries.projects.visible("space-cela");
		const live = queries.projects.visibleLive("space-cela");
		// Same invariant as channels, keyed by spaceId: identical options => identical key.
		expect(live.queryKey).toEqual(plain.queryKey);
	});
});

describe("typed key factory is behaviour-preserving (keys hash identically)", () => {
	test("projection keys equal the pre-factory literals, fully qualified", () => {
		expect(queries.company.shell("c1").queryKey).toEqual([...PREFIX, "company", "shell", "c1"]);
		expect(queries.company.resolve("slug").queryKey).toEqual([
			...PREFIX,
			"company",
			"resolve",
			"slug",
		]);
		expect(queries.team.roster({ companyId: "c1", ownerActorId: null }).queryKey).toEqual([
			...PREFIX,
			"team",
			"roster",
			"c1",
		]);
		expect(queries.spaces.directory("c1").queryKey).toEqual([
			...PREFIX,
			"spaces",
			"directory",
			"c1",
		]);
		// Channels are SPACE-scoped, so the directory projection key is keyed by spaceId.
		expect(queries.channels.directory("s1").queryKey).toEqual([
			...PREFIX,
			"channels",
			"directory",
			"s1",
		]);
		// Projects are SPACE-scoped like channels, so the directory key is keyed by spaceId.
		expect(queries.projects.directory("s1").queryKey).toEqual([
			...PREFIX,
			"projects",
			"directory",
			"s1",
		]);
		expect(queries.activity.feed("c1").queryKey).toEqual([...PREFIX, "activity", "feed", "c1"]);
		expect(queries.onboarding.state().queryKey).toEqual([...PREFIX, "onboarding", "state"]);
	});

	test("session key is unchanged", () => {
		const session = createSessionQuery(q, { baseURL: BASE_URL });
		expect(session().queryKey).toEqual([...PREFIX, "auth", "get-session"]);
	});
});

describe("consistency-group fan-outs are ready invalidate targets", () => {
	test("collection() fully-qualified prefix matches the real collection reads", () => {
		const spacesKey = queries.spaces.visible("c1").queryKey;
		const spacesPrefix = keys.collection("spaces");
		expect(spacesPrefix).toEqual([...PREFIX, "collections", "spaces"]);
		expect(spacesKey.slice(0, spacesPrefix.length)).toEqual(spacesPrefix);
	});

	test("onSpaceChange fans out over spaces collection + shell + directory", () => {
		const [collectionTarget, shellTarget, directoryTarget] = keys.onSpaceChange("c1");
		expect(collectionTarget).toEqual([...PREFIX, "collections", "spaces"]);
		// Projection targets are qualified, so they exactly match the real cache keys.
		expect(shellTarget).toEqual(queries.company.shell("c1").queryKey);
		expect(directoryTarget).toEqual(queries.spaces.directory("c1").queryKey);
		const spacesKey = queries.spaces.visible("c1").queryKey;
		expect(spacesKey.slice(0, collectionTarget.length)).toEqual(collectionTarget);
	});

	test("onChannelChange fans out over the channels collection + the space-scoped directory", () => {
		const [collectionTarget, directoryTarget] = keys.onChannelChange("s1");
		expect(collectionTarget).toEqual([...PREFIX, "collections", "channels"]);
		// Directory target is qualified + keyed by spaceId, so it matches the real key.
		expect(directoryTarget).toEqual(queries.channels.directory("s1").queryKey);
		// The channels prefix prefix-matches the real space-scoped channels read.
		const channelsKey = queries.channels.visible("s1").queryKey;
		expect(channelsKey.slice(0, collectionTarget.length)).toEqual(collectionTarget);
	});
	test("onProjectChange fans out over the projects collection + the space-scoped directory", () => {
		const [collectionTarget, directoryTarget] = keys.onProjectChange("s1");
		expect(collectionTarget).toEqual([...PREFIX, "collections", "projects"]);
		// Directory target is qualified + keyed by spaceId, so it matches the real key.
		expect(directoryTarget).toEqual(queries.projects.directory("s1").queryKey);
		// The projects prefix prefix-matches the real space-scoped projects read.
		const projectsKey = queries.projects.visible("s1").queryKey;
		expect(projectsKey.slice(0, collectionTarget.length)).toEqual(collectionTarget);
	});

	test("onAgentChange fans out over the ACTORS collection (agents are not a collection)", () => {
		const [collectionTarget, shellTarget, rosterTarget] = keys.onAgentChange("c1");
		// The critical correctness point: actors, NOT a non-existent agents collection.
		expect(collectionTarget).toEqual([...PREFIX, "collections", "actors"]);
		expect(shellTarget).toEqual(queries.company.shell("c1").queryKey);
		expect(rosterTarget).toEqual(
			queries.team.roster({ companyId: "c1", ownerActorId: null }).queryKey,
		);
		// The actors prefix prefix-matches the real agents (kind:"agent") read.
		const agentsKey = queries.actors.agents("c1").queryKey;
		expect(agentsKey.slice(0, collectionTarget.length)).toEqual(collectionTarget);
	});
});
