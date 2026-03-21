import { describe, test, expect } from "bun:test";
import { aggregateEvents, formatEntry } from "../src/events/aggregator.js";
import type { ProviderEvent } from "../src/events/types.js";

function makeEvent(
  type: string,
  payload: Record<string, unknown>,
  ts = "2026-03-21T14:32:00.000Z"
): ProviderEvent {
  return { type, ts, provider: "claude", payload } as any;
}

describe("Event Aggregator", () => {
  const events: ProviderEvent[] = [
    makeEvent("session-start", { sdkSessionId: "sdk-123" }),
    makeEvent("assistant-text-delta", { text: "Hello " }),
    makeEvent("assistant-text-delta", { text: "world" }),
    makeEvent("tool-call-start", { toolName: "Read", toolId: "t1" }),
    makeEvent("tool-call-end", { toolName: "Read", toolId: "t1" }),
    makeEvent("tool-call-start", { toolName: "Read", toolId: "t2" }),
    makeEvent("tool-call-end", { toolName: "Read", toolId: "t2" }),
    makeEvent("tool-call-start", { toolName: "Edit", toolId: "t3" }),
    makeEvent("tool-call-end", { toolName: "Edit", toolId: "t3" }),
    makeEvent("assistant-message", { text: "Done editing." }),
    makeEvent("notification", { message: "Validation: PASS", level: "info" }),
    makeEvent("session-end", { reason: "completed", duration: 12000 }),
  ];

  test("conversation mode folds text deltas", () => {
    const entries = aggregateEvents(events, "conversation");

    // Should have: session-start, folded text, assistant-message, validation notification, session-end
    // Tool calls are skipped in conversation mode
    const kinds = entries.map((e) => e.kind);
    expect(kinds).toContain("system"); // session-start
    expect(kinds).toContain("assistant"); // folded deltas + assistant-message

    // Folded text should combine deltas
    const assistantEntries = entries.filter((e) => e.kind === "assistant");
    expect(assistantEntries.some((e) => e.text === "Hello world")).toBe(true);
  });

  test("conversation mode skips tool-call-start events", () => {
    const entries = aggregateEvents(events, "conversation");
    const toolEntries = entries.filter((e) => e.kind === "tool");
    expect(toolEntries.length).toBe(0);
  });

  test("activity mode groups consecutive tool calls", () => {
    const entries = aggregateEvents(events, "activity");
    const toolEntries = entries.filter((e) => e.kind === "tool");
    // Should group Read(2x) + Edit into one summary
    expect(toolEntries.length).toBeGreaterThan(0);
    const grouped = toolEntries.find((e) => e.text.includes("Read (2x)"));
    expect(grouped).toBeDefined();
  });

  test("raw mode returns all events 1:1", () => {
    const entries = aggregateEvents(events, "raw");
    expect(entries.length).toBe(events.length);
    expect(entries.every((e) => e.kind === "raw")).toBe(true);
  });

  test("formatEntry produces non-empty strings", () => {
    const entries = aggregateEvents(events, "conversation");
    for (const entry of entries) {
      const formatted = formatEntry(entry);
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  test("handles empty events array", () => {
    expect(aggregateEvents([], "conversation")).toEqual([]);
    expect(aggregateEvents([], "activity")).toEqual([]);
    expect(aggregateEvents([], "raw")).toEqual([]);
  });

  test("validation notification detected", () => {
    const entries = aggregateEvents(events, "conversation");
    const validationEntries = entries.filter((e) => e.kind === "validation");
    expect(validationEntries.length).toBe(1);
    expect(validationEntries[0]!.text).toContain("Validation: PASS");
  });

  test("error events shown in all modes", () => {
    const errorEvents: ProviderEvent[] = [
      makeEvent("error", { message: "Something failed" }),
    ];
    for (const mode of ["conversation", "activity", "raw"] as const) {
      const entries = aggregateEvents(errorEvents, mode);
      expect(entries.length).toBe(1);
    }
  });
});

describe("CLI Session Commands", () => {
  test("qap session --help exits 0", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "session", "--help"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: "/tmp/qap-session-test-" + Date.now() },
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap session");
    expect(stdout).toContain("list");
    expect(stdout).toContain("show");
    expect(stdout).toContain("latest");
    expect(stdout).toContain("current");
  });

  test("qap logs --help exits 0", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "logs", "--help"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: "/tmp/qap-logs-test-" + Date.now() },
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("qap logs");
    expect(stdout).toContain("conversation");
    expect(stdout).toContain("activity");
    expect(stdout).toContain("raw");
  });

  test("qap --help contains session commands", async () => {
    const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: "/tmp/qap-help-test-" + Date.now() },
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("session list");
    expect(stdout).toContain("session show");
    expect(stdout).toContain("session latest");
    expect(stdout).toContain("session current");
    expect(stdout).toContain("say");
    expect(stdout).toContain("interrupt");
    expect(stdout).toContain("--view");
  });
});
