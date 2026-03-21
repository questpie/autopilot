import { describe, test, expect } from "bun:test";
import { renderPrompt, type SteeringContext } from "../src/prompts/renderer.js";
import type { ProjectConfig, TaskRunState } from "../src/core/types.js";

const minimalConfig: ProjectConfig = {
  project: { id: "test", name: "Test", rootDir: "/tmp" },
  execution: {
    mode: "autonomous",
    defaultProvider: "claude",
    defaultPermissionProfile: "safe",
  },
  prompts: {},
  epics: [{ id: "E1", title: "Epic 1", track: "main" }],
  tasks: [
    {
      id: "T1",
      title: "Task 1",
      epicId: "E1",
      kind: "implementation",
      track: "main",
      acceptanceCriteria: ["Works"],
    },
  ],
};

const states: Record<string, TaskRunState> = {
  T1: { id: "T1", state: "ready", notes: [], runs: [], retries: 0 },
};

describe("Prompt steering injection", () => {
  test("renders prompt without steering when not provided", async () => {
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states);
    expect(prompt).not.toContain("# Steering Notes");
  });

  test("renders prompt with project steering", async () => {
    const steering: SteeringContext = {
      projectSteering: "Focus on type safety",
    };
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states, steering);
    expect(prompt).toContain("# Steering Notes");
    expect(prompt).toContain("## Project Steering");
    expect(prompt).toContain("Focus on type safety");
  });

  test("renders prompt with task notes", async () => {
    const steering: SteeringContext = {
      taskNotes: ["Use new auth middleware", "Check PR #42"],
    };
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states, steering);
    expect(prompt).toContain("## Task Notes");
    expect(prompt).toContain("Use new auth middleware");
    expect(prompt).toContain("Check PR #42");
  });

  test("renders prompt with session notes", async () => {
    const steering: SteeringContext = {
      sessionNotes: ["Be careful with DB migrations"],
    };
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states, steering);
    expect(prompt).toContain("## Session Notes");
    expect(prompt).toContain("Be careful with DB migrations");
  });

  test("renders all three steering levels together", async () => {
    const steering: SteeringContext = {
      projectSteering: "Project-level guidance",
      taskNotes: ["Task-level note"],
      sessionNotes: ["Session-level note"],
    };
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states, steering);
    expect(prompt).toContain("## Project Steering");
    expect(prompt).toContain("## Task Notes");
    expect(prompt).toContain("## Session Notes");

    // Steering should appear before task context
    const steeringIdx = prompt.indexOf("# Steering Notes");
    const taskIdx = prompt.indexOf("# Task: T1");
    expect(steeringIdx).toBeLessThan(taskIdx);
  });

  test("omits empty steering sections", async () => {
    const steering: SteeringContext = {
      projectSteering: null,
      taskNotes: [],
      sessionNotes: [],
    };
    const prompt = await renderPrompt(minimalConfig, minimalConfig.tasks[0]!, "implement", states, steering);
    expect(prompt).not.toContain("# Steering Notes");
  });
});
