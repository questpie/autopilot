import { useState, useCallback, useEffect } from "react";
import { useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/react";
import { BRAND } from "./brand.js";
import { Header } from "./components/header.js";
import { ProjectPanel } from "./components/project-panel.js";
import { TasksPanel } from "./components/tasks-panel.js";
import { LogPanel } from "./components/log-panel.js";
import { CommandInput } from "./components/command-input.js";
import { HelpOverlay } from "./components/help-overlay.js";
import type { TuiState } from "./state.js";
import { createInitialState, loadTuiState } from "./state.js";
import { handleCommand } from "./commands.js";

export function App() {
  const { width, height } = useTerminalDimensions();
  const renderer = useRenderer();
  const [state, setState] = useState<TuiState>(createInitialState);
  const [showHelp, setShowHelp] = useState(false);

  // Load project state on mount
  useEffect(() => {
    loadTuiState().then((s) => {
      if (s) setState(s);
    });
  }, []);

  // Global keybindings
  useKeyboard((key) => {
    if (key.name === "escape" && showHelp) {
      setShowHelp(false);
    }
    // Ctrl+L refreshes state
    if (key.ctrl && key.name === "l") {
      loadTuiState().then((s) => {
        if (s) setState(s);
      });
    }
  });

  const onCommand = useCallback(
    async (cmd: string) => {
      if (cmd === "/help") {
        setShowHelp((v) => !v);
        return;
      }

      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, `> ${cmd}`].slice(-100),
      }));

      const result = await handleCommand(cmd, state);
      if (result.newState) {
        setState(result.newState);
      }
      if (result.log) {
        setState((prev) => ({
          ...prev,
          logs: [...prev.logs, result.log!].slice(-100),
        }));
      }
    },
    [state]
  );

  // Layout calculations
  const headerH = 3;
  const inputH = 3;
  const mainH = height - headerH - inputH;
  const leftW = Math.floor(width * 0.4);
  const rightW = width - leftW;
  const topPanelH = Math.floor(mainH * 0.5);
  const bottomPanelH = mainH - topPanelH;

  return (
    <box
      width={width}
      height={height}
      backgroundColor={BRAND.bg}
      flexDirection="column"
    >
      {/* Header bar */}
      <Header
        width={width}
        project={state.activeProject}
        taskCounts={state.taskCounts}
      />

      {/* Main content area */}
      <box width={width} height={mainH} flexDirection="row">
        {/* Left column */}
        <box width={leftW} height={mainH} flexDirection="column">
          <ProjectPanel
            width={leftW}
            height={topPanelH}
            project={state.activeProject}
          />
          <LogPanel
            width={leftW}
            height={bottomPanelH}
            logs={state.logs}
          />
        </box>

        {/* Right column */}
        <box width={rightW} height={mainH} flexDirection="column">
          <TasksPanel
            width={rightW}
            height={topPanelH}
            title="READY"
            tasks={state.readyTasks}
            emptyText="No ready tasks"
            statusColor={BRAND.success}
          />
          <TasksPanel
            width={rightW}
            height={bottomPanelH}
            title="COMPLETED / FAILED"
            tasks={state.completedTasks}
            emptyText="No completed tasks"
            statusColor={BRAND.fgDim}
          />
        </box>
      </box>

      {/* Command input */}
      <CommandInput width={width} onSubmit={onCommand} />

      {/* Help overlay */}
      {showHelp && (
        <HelpOverlay
          width={width}
          height={height}
          onClose={() => setShowHelp(false)}
        />
      )}
    </box>
  );
}
