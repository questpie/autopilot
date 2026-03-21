import { useMemo } from "react";
import { BRAND } from "../brand.js";
import { ProjectPanel } from "./project-panel.js";
import { ProjectPicker } from "./project-picker.js";
import { TasksPanel } from "./tasks-panel.js";
import { SessionsPanel } from "./sessions-panel.js";
import { SessionDetailPanel } from "./session-detail-panel.js";
import { LogPanel } from "./log-panel.js";
import { RunPanel } from "./run-panel.js";
import type { TuiState } from "../state.js";
import { aggregateEvents } from "../../events/aggregator.js";
import type { ProviderEvent } from "../../events/types.js";

interface MainContentProps {
  state: TuiState;
  width: number;
  mainH: number;
  leftW: number;
  rightW: number;
  topPanelH: number;
  bottomPanelH: number;
  onSessionSelect?: (sessionId: string) => void;
}

/**
 * Parse raw session event strings back into minimal ProviderEvent objects
 * for aggregation. This is a best-effort conversion from the display strings
 * stored in state.sessionEvents.
 */
function parseSessionEventsForAggregation(
  rawEvents: string[],
  _mode: TuiState["logViewMode"]
) {
  // sessionEvents are already formatted strings — we aggregate from raw events
  // when available. For now, return the strings as-is for the fallback path.
  return rawEvents;
}

export function MainContent({
  state,
  width,
  mainH,
  leftW,
  rightW,
  topPanelH,
  bottomPanelH,
  onSessionSelect,
}: MainContentProps) {
  // Compute aggregated entries for the log panel based on view mode
  const aggregatedEntries = useMemo(() => {
    if (state.rawSessionEvents && state.rawSessionEvents.length > 0) {
      return aggregateEvents(state.rawSessionEvents, state.logViewMode);
    }
    return undefined;
  }, [state.rawSessionEvents, state.logViewMode]);

  // Activity entries for session detail
  const activityEntries = useMemo(() => {
    if (state.rawSessionEvents && state.rawSessionEvents.length > 0) {
      return aggregateEvents(state.rawSessionEvents, "activity").slice(-15);
    }
    return undefined;
  }, [state.rawSessionEvents]);

  // Session ID for log panel header
  const logSessionId = state.runningSession?.id ?? state.selectedSession?.id;

  if (state.needsProjectPicker) {
    return (
      <box width={width} height={mainH} flexDirection="row">
        <ProjectPicker
          width={width}
          height={mainH}
          projects={state.projects}
          activeId={state.workspace?.activeProject}
        />
      </box>
    );
  }

  if (state.activeView === "session-detail" && state.selectedSession) {
    return (
      <box width={width} height={mainH} flexDirection="row">
        <SessionDetailPanel
          width={width}
          height={mainH}
          session={state.selectedSession}
          activityEntries={activityEntries}
        />
      </box>
    );
  }

  if (state.activeView === "sessions") {
    return (
      <box width={width} height={mainH} flexDirection="row">
        <SessionsPanel
          width={width}
          height={mainH}
          sessions={state.sessions}
          onSelect={onSessionSelect}
        />
      </box>
    );
  }

  if (state.activeView === "logs") {
    return (
      <box width={width} height={mainH} flexDirection="row">
        <LogPanel
          width={width}
          height={mainH}
          logs={state.sessionEvents.length > 0 ? state.sessionEvents : state.logs}
          title={` LOG${logSessionId ? ` ${logSessionId.slice(0, 8)}` : ""} ${state.logViewMode.toUpperCase()} `}
          viewMode={state.logViewMode}
          aggregatedEntries={aggregatedEntries}
          sessionId={logSessionId}
        />
      </box>
    );
  }

  // Default: project view with tasks + run panel
  const runPanelH = Math.min(Math.floor(mainH * 0.3), 8);
  const rightContentH = mainH - runPanelH;
  const rightTopH = Math.floor(rightContentH * 0.5);
  const rightBottomH = rightContentH - rightTopH;

  return (
    <box width={width} height={mainH} flexDirection="row">
      <box width={leftW} height={mainH} flexDirection="column">
        <ProjectPanel
          width={leftW}
          height={topPanelH}
          workspace={state.workspace}
          project={state.activeProject}
        />
        <LogPanel
          width={leftW}
          height={bottomPanelH}
          logs={state.sessionEvents.length > 0 ? state.sessionEvents : state.logs}
          title={state.sessionEvents.length > 0 ? " EVENTS " : " LOG "}
          viewMode={state.logViewMode}
          aggregatedEntries={aggregatedEntries}
          sessionId={logSessionId}
        />
      </box>

      <box width={rightW} height={mainH} flexDirection="column">
        <RunPanel
          width={rightW}
          height={runPanelH}
          runningSession={state.runningSession}
          inProgressTasks={state.inProgressTasks}
          taskCounts={state.taskCounts}
        />
        <TasksPanel
          width={rightW}
          height={rightTopH}
          title="READY"
          tasks={state.readyTasks}
          emptyText="No ready tasks"
          statusColor={BRAND.success}
        />
        <TasksPanel
          width={rightW}
          height={rightBottomH}
          title="COMPLETED / FAILED"
          tasks={state.completedTasks}
          emptyText="No completed tasks"
          statusColor={BRAND.fgDim}
        />
      </box>
    </box>
  );
}
