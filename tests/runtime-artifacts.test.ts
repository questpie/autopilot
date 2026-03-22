import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Store } from "../src/storage/store.js";
import {
  getProjectDirFromRepo,
  getProjectStatePath,
} from "../src/workspace/types.js";

const TEST_HOME = `/tmp/qap-runtime-${Date.now()}`;
const ORIG_HOME = process.env.HOME;
const ORIG_CWD = process.cwd();

beforeEach(async () => {
  process.env.HOME = TEST_HOME;
  process.chdir("/tmp");
  await mkdir(TEST_HOME, { recursive: true });
});

afterEach(async () => {
  process.env.HOME = ORIG_HOME;
  process.chdir(ORIG_CWD);
  if (existsSync(TEST_HOME)) {
    await rm(TEST_HOME, { recursive: true, force: true });
  }
});

describe("runtime artifact paths", () => {
  test("project dir from repo uses resolved repo root", () => {
    expect(getProjectDirFromRepo("questpie-test", "proj")).toBe(
      getProjectDirFromRepo(resolve("questpie-test"), "proj")
    );
  });

  test("store writes runtime state to run-state.json", async () => {
    const repoRoot = "/tmp/runtime-repo";
    await mkdir(repoRoot, { recursive: true });

    const store = new Store(repoRoot, "proj");
    await store.load();
    store.initTask("T-1");
    await store.save();

    expect(existsSync(getProjectStatePath(repoRoot, "proj"))).toBe(true);
    expect(
      existsSync(`${getProjectDirFromRepo(repoRoot, "proj")}/state.json`)
    ).toBe(false);
  });

  test("store ignores non-runtime project state.json schema", async () => {
    const repoRoot = "/tmp/external-state-repo";
    const projectDir = getProjectDirFromRepo(repoRoot, "proj");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      `${projectDir}/state.json`,
      JSON.stringify(
        {
          projectId: "proj",
          tasks: {
            "EXT-1": {
              status: "done",
              mode: "external-direct",
            },
          },
        },
        null,
        2
      )
    );

    const store = new Store(repoRoot, "proj");
    await store.load();

    expect(store.getAllTasks()).toEqual({});
    const untouched = JSON.parse(
      await readFile(`${projectDir}/state.json`, "utf-8")
    ) as {
      tasks: Record<string, { status: string }>;
    };
    expect(untouched.tasks["EXT-1"]?.status).toBe("done");
  });

  test("store migrates from legacy project-dir state.json when it matches runtime schema", async () => {
    const repoRoot = "/tmp/legacy-project-state-repo";
    const projectDir = getProjectDirFromRepo(repoRoot, "proj");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      `${projectDir}/state.json`,
      JSON.stringify(
        {
          projectId: "proj",
          startedAt: "2026-01-01T00:00:00.000Z",
          lastUpdatedAt: "2026-01-01T00:00:00.000Z",
          tasks: {
            "T-1": {
              id: "T-1",
              state: "done",
              notes: [],
              runs: [],
              retries: 0,
              validationHistory: [],
              remediationAttempts: 0,
              remediationHistory: [],
            },
          },
          changelog: [],
          sessionId: "legacy-session",
        },
        null,
        2
      )
    );

    const store = new Store(repoRoot, "proj");
    await store.load();

    expect(store.getTask("T-1")?.state).toBe("done");
    expect(store.getSessionId()).toBe("legacy-session");

    await store.save();
    expect(existsSync(getProjectStatePath(repoRoot, "proj"))).toBe(true);
  });
});
