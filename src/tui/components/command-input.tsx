import { useState, useCallback, useMemo } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { BRAND } from "../brand.js";

// ── Command Definitions ──

interface CommandDef {
  command: string;
  args?: string;
  description: string;
}

const COMMAND_DEFS: CommandDef[] = [
  { command: "/project", description: "Show project info" },
  { command: "/project list", description: "List all projects" },
  { command: "/project use", args: "<id>", description: "Switch active project" },
  { command: "/project init", description: "Initialize new project" },
  { command: "/project import", description: "Import existing project" },
  { command: "/sessions", description: "Show session history" },
  { command: "/session show", args: "<id>", description: "Show session details" },
  { command: "/session latest", description: "Show latest session" },
  { command: "/session current", description: "Show running session" },
  { command: "/run", description: "Run next ready task" },
  { command: "/run-next", description: "Run next ready task" },
  { command: "/run-task", args: "<task-id>", description: "Run specific task" },
  { command: "/retry", args: "<task-id>", description: "Retry a failed task" },
  { command: "/status", description: "Show task counts" },
  { command: "/note", args: "<task-id> <text>", description: "Add note to task" },
  { command: "/note show", args: "<task-id>", description: "Show task notes" },
  { command: "/steer project", args: "<text>", description: "Add steering note" },
  { command: "/steer show", description: "Show steering notes" },
  { command: "/refresh", description: "Reload state" },
  { command: "/help", description: "Toggle help" },
];

// ── Props ──

interface CommandInputProps {
  width: number;
  onSubmit: (cmd: string) => void;
  taskIds?: string[];
  sessionIds?: string[];
  projectIds?: string[];
}

export function CommandInput({
  width,
  onSubmit,
  taskIds = [],
  sessionIds = [],
  projectIds = [],
}: CommandInputProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const renderer = useRenderer();

  // Compute suggestions based on current input
  const suggestions = useMemo(() => {
    const v = value.trim();
    if (!v) return [];

    // If typing a slash command, match against command defs
    if (v.startsWith("/")) {
      const parts = v.split(/\s+/);
      const cmdPart = parts.slice(0, -1).join(" ") || v;
      const lastPart = parts.length > 1 ? parts[parts.length - 1]! : "";

      // Check if we need to complete an argument (task ID, session ID, project ID)
      const matchedCmd = COMMAND_DEFS.find(
        (d) => d.command === cmdPart || d.command === parts.slice(0, 2).join(" ")
      );

      if (matchedCmd && parts.length >= 2) {
        // We're past the command, autocomplete the argument
        const needsTaskId =
          matchedCmd.args?.includes("<task-id>") ||
          matchedCmd.args?.includes("<id>") && matchedCmd.command.includes("run");
        const needsSessionId =
          matchedCmd.command.includes("session") && matchedCmd.args?.includes("<id>");
        const needsProjectId =
          matchedCmd.command.includes("project use");

        let candidates: string[] = [];
        if (needsTaskId || matchedCmd.command === "/retry" || matchedCmd.command === "/run-task") {
          candidates = taskIds;
        } else if (needsSessionId) {
          candidates = sessionIds;
        } else if (needsProjectId) {
          candidates = projectIds;
        } else if (matchedCmd.command === "/note" && !matchedCmd.command.includes("show")) {
          candidates = taskIds;
        } else if (matchedCmd.command === "/note show") {
          candidates = taskIds;
        }

        if (candidates.length > 0 && lastPart) {
          const lower = lastPart.toLowerCase();
          return candidates
            .filter((id) => id.toLowerCase().includes(lower))
            .slice(0, 8)
            .map((id) => ({
              text: `${cmdPart} ${id}`,
              display: id,
              description: "",
            }));
        }

        if (candidates.length > 0 && parts.length === 2 && lastPart === "") {
          return candidates.slice(0, 8).map((id) => ({
            text: `${matchedCmd.command} ${id}`,
            display: id,
            description: "",
          }));
        }
      }

      // Match commands
      const lower = v.toLowerCase();
      return COMMAND_DEFS.filter((d) => d.command.toLowerCase().startsWith(lower))
        .slice(0, 8)
        .map((d) => ({
          text: d.command,
          display: `${d.command}${d.args ? " " + d.args : ""}`,
          description: d.description,
        }));
    }

    return [];
  }, [value, taskIds, sessionIds, projectIds]);

  // Build hint text for the current command
  const hint = useMemo(() => {
    const v = value.trim();
    if (!v || !v.startsWith("/")) return "";

    const parts = v.split(/\s+/);
    const matched = COMMAND_DEFS.find(
      (d) =>
        d.command === v ||
        d.command === parts.slice(0, 2).join(" ") ||
        d.command === parts[0]
    );

    if (matched) {
      const argHint = matched.args ? ` ${matched.args}` : "";
      return `${matched.command}${argHint} — ${matched.description}`;
    }

    return "";
  }, [value]);

  useKeyboard(
    useCallback(
      (key: { name?: string; ctrl?: boolean; shift?: boolean }) => {
        // ESC → clear input
        if (key.name === "escape" && value.length > 0) {
          setValue("");
          setHistoryIdx(-1);
          setSelectedSuggestion(0);
          return;
        }

        // Ctrl+C → exit
        if (key.ctrl && key.name === "c") {
          renderer.destroy();
          return;
        }

        // Up/Down for history and suggestion navigation
        if (key.name === "up") {
          if (suggestions.length > 0) {
            setSelectedSuggestion((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1
            );
          } else if (history.length > 0) {
            const newIdx = historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
            setHistoryIdx(newIdx);
            setValue(history[history.length - 1 - newIdx] ?? "");
          }
          return;
        }

        if (key.name === "down") {
          if (suggestions.length > 0) {
            setSelectedSuggestion((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0
            );
          } else if (historyIdx > 0) {
            const newIdx = historyIdx - 1;
            setHistoryIdx(newIdx);
            setValue(history[history.length - 1 - newIdx] ?? "");
          } else if (historyIdx === 0) {
            setHistoryIdx(-1);
            setValue("");
          }
          return;
        }

        // Tab → accept selected suggestion
        if (key.name === "tab" && suggestions.length > 0) {
          const selected = suggestions[selectedSuggestion];
          if (selected) {
            setValue(selected.text + " ");
            setSelectedSuggestion(0);
          }
          return;
        }
      },
      [value, history, historyIdx, suggestions, selectedSuggestion, renderer]
    )
  );

  const handleSubmit = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;

    // If suggestions are visible, Tab-to-accept takes priority,
    // but Enter always submits
    setHistory((prev) => [...prev.slice(-50), trimmed]);
    setHistoryIdx(-1);
    setSelectedSuggestion(0);
    onSubmit(trimmed);
    setValue("");
  };

  const showSuggestions = value.trim().length > 0 && suggestions.length > 0;
  const suggestionH = showSuggestions ? Math.min(suggestions.length, 8) : 0;

  return (
    <box width={width} flexDirection="column">
      {/* Suggestion dropdown (above input) */}
      {showSuggestions && (
        <box
          width={Math.min(width - 2, 60)}
          height={suggestionH}
          backgroundColor={BRAND.surface}
          border
          borderStyle="single"
          borderColor={BRAND.border}
          flexDirection="column"
        >
          {suggestions.map((s, i) => (
            <box
              key={s.text}
              flexDirection="row"
              backgroundColor={
                i === selectedSuggestion ? BRAND.card : BRAND.surface
              }
            >
              <text
                fg={i === selectedSuggestion ? BRAND.purple : BRAND.fg}
              >
                {i === selectedSuggestion ? (
                  <strong>{` ${s.display.padEnd(28)}`}</strong>
                ) : (
                  ` ${s.display.padEnd(28)}`
                )}
              </text>
              <text fg={BRAND.fgDim}>{s.description}</text>
            </box>
          ))}
        </box>
      )}

      {/* Hint line */}
      {hint && !showSuggestions && (
        <box width={width} height={1} paddingLeft={4}>
          <text fg={BRAND.fgMuted}>{hint}</text>
        </box>
      )}

      {/* Input line */}
      <box
        width={width}
        height={3}
        flexDirection="column"
        backgroundColor={BRAND.surface}
        border
        borderStyle="single"
        borderColor={BRAND.purple}
      >
        <box flexDirection="row" alignItems="center">
          <text fg={BRAND.purple}>
            <strong>{" ▸ "}</strong>
          </text>
          <input
            width={width - 6}
            value={value}
            onChange={(v: string) => {
              setValue(v);
              setHistoryIdx(-1);
              setSelectedSuggestion(0);
            }}
            onSubmit={handleSubmit as any}
            placeholder="Type / for commands, Tab to complete, Up/Down for history"
            backgroundColor={BRAND.surface}
            focusedBackgroundColor={BRAND.card}
            textColor={BRAND.fg}
            cursorColor={BRAND.purple}
            placeholderColor={BRAND.fgMuted}
            focused
          />
        </box>
      </box>
    </box>
  );
}
