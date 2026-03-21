import { useState, useCallback, useEffect, useRef } from "react";
import { useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/react";
import { BRAND } from "./brand.js";
import { Header } from "./components/header.js";
import { ProjectPanel } from "./components/project-panel.js";
import { ProjectPicker } from "./components/project-picker.js";
import { TasksPanel } from "./components/tasks-panel.js";
import { SessionsPanel } from "./components/sessions-panel.js";
import { LogPanel } from "./components/log-panel.js";
import { CommandInput } from "./components/command-input.js";
import { HelpOverlay } from "./components/help-overlay.js";
import { MainContent } from "./components/main-content.js";
import type { TuiState, TuiView } from "./state.js";
import { createInitialState, loadTuiState } from "./state.js";
import { handleCommand } from "./commands.js";

const TAB_MAP: Record<string, TuiView> = {
  "1": "project",
  "2": "sessions",
  "3": "logs",
  "4": "help",
};

export function App() {
  const { width, height } = useTerminalDimensions();
  const [state, setState] = useState<TuiState>(createInitialState);

  // Ref to always have latest state for async command handler
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load project state on mount
  useEffect(() => {
    loadTuiState().then((s) => {
      if (s) setState(s);
    });
  }, []);

  // Auto-refresh polling (every 3s) for live execution visibility
  useEffect(() => {
    const interval = setInterval(() => {
      loadTuiState().then((s) => {
        if (s) {
          setState((prev) => ({
            ...s,
            // Preserve user's active view and logs
            activeView: prev.activeView,
            logs: prev.logs,
          }));
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Global keybindings — all state access via functional setState
  useKeyboard(useCallback((key: { name?: string; ctrl?: boolean }) => {
    if (key.name === "escape") {
      setState((prev) =>
        prev.activeView === "help" ? { ...prev, activeView: "project" } : prev
      );
    }

    if (key.ctrl && key.name === "l") {
      loadTuiState().then((s) => {
        if (s) setState(s);
      });
    }

    const tab = key.name ? TAB_MAP[key.name] : undefined;
    if (tab) {
      setState((prev) => ({ ...prev, activeView: tab }));
    }
  }, []));

  // Stable command handler — uses ref for current state, functional setState for updates
  const onCommand = useCallback(async (cmd: string) => {
    if (cmd === "/help") {
      setState((prev) => ({
        ...prev,
        activeView: prev.activeView === "help" ? "project" : "help",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, `> ${cmd}`].slice(-100),
    }));

    const result = await handleCommand(cmd, stateRef.current);

    if (result.newState) {
      setState(result.newState);
    }
    if (result.log) {
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs, result.log!].slice(-100),
      }));
    }
  }, []);

  // Stable close handler for help overlay
  const closeHelp = useCallback(() => {
    setState((prev) => ({ ...prev, activeView: "project" }));
  }, []);

  // Layout calculations
  const headerH = 4;
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
      <Header
        width={width}
        workspace={state.workspace}
        project={state.activeProject}
        taskCounts={state.taskCounts}
        activeView={state.activeView}
        updateStatus={state.updateStatus}
      />

      <MainContent
        state={state}
        width={width}
        mainH={mainH}
        leftW={leftW}
        rightW={rightW}
        topPanelH={topPanelH}
        bottomPanelH={bottomPanelH}
      />

      <CommandInput width={width} onSubmit={onCommand} />

      {state.activeView === "help" && (
        <HelpOverlay
          width={width}
          height={height}
          onClose={closeHelp}
        />
      )}
    </box>
  );
}
