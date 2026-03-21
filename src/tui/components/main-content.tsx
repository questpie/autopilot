import { BRAND } from "../brand.js";
import { ProjectPanel } from "./project-panel.js";
import { ProjectPicker } from "./project-picker.js";
import { TasksPanel } from "./tasks-panel.js";
import { SessionsPanel } from "./sessions-panel.js";
import { LogPanel } from "./log-panel.js";
import { RunPanel } from "./run-panel.js";
import type { TuiState } from "../state.js";

interface MainContentProps {
  state: TuiState;
  width: number;
  mainH: number;
  leftW: number;
  rightW: number;
  topPanelH: number;
  bottomPanelH: number;
}

export function MainContent({
  state,
  width,
  mainH,
  leftW,
  rightW,
  topPanelH,
  bottomPanelH,
}: MainContentProps) {
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

  if (state.activeView === "sessions") {
    return (
      <box width={width} height={mainH} flexDirection="row">
        <SessionsPanel
          width={width}
          height={mainH}
          sessions={state.sessions}
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
          logs={state.logs}
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
          logs={state.logs}
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
