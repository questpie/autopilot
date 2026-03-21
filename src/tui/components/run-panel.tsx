import { BRAND } from "../brand.js";
import type { RunningSession, TaskEntry } from "../state.js";

interface RunPanelProps {
  width: number;
  height: number;
  runningSession: RunningSession | null;
  inProgressTasks: TaskEntry[];
  taskCounts: {
    total: number;
    ready: number;
    inProgress: number;
    done: number;
    failed: number;
    blocked: number;
  };
}

export function RunPanel({
  width,
  height,
  runningSession,
  inProgressTasks,
  taskCounts,
}: RunPanelProps) {
  if (!runningSession) {
    return (
      <box
        width={width}
        height={height}
        border
        borderStyle="single"
        borderColor={BRAND.border}
        title=" EXECUTION "
        titleAlignment="left"
        backgroundColor={BRAND.card}
        flexDirection="column"
      >
        <box padding={1}>
          <text fg={BRAND.fgDim}>No active run. Use /run or /run-task to start.</text>
        </box>
        <box flexDirection="row" gap={2} paddingLeft={1}>
          <text fg={BRAND.success}>{`${taskCounts.done} done`}</text>
          <text fg={BRAND.info}>{`${taskCounts.ready} ready`}</text>
          <text fg={BRAND.error}>{`${taskCounts.failed} failed`}</text>
          <text fg={BRAND.fgDim}>{`${taskCounts.total} total`}</text>
        </box>
      </box>
    );
  }

  const progress = runningSession.taskCount > 0
    ? Math.round((runningSession.tasksCompleted / runningSession.taskCount) * 100)
    : 0;

  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.purple}
      title=" RUNNING "
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      <box flexDirection="row" gap={2} paddingLeft={1}>
        <text fg={BRAND.purple}>
          <strong>{`Session ${runningSession.id.slice(0, 8)}`}</strong>
        </text>
        <text fg={BRAND.success}>{`${runningSession.tasksCompleted} done`}</text>
        <text fg={BRAND.error}>{`${runningSession.tasksFailed} failed`}</text>
        <text fg={BRAND.fgDim}>{`${progress}%`}</text>
      </box>

      {runningSession.currentTaskId && (
        <box paddingLeft={1}>
          <text fg={BRAND.info}>
            {`▸ Current: ${runningSession.currentTaskId}`}
          </text>
        </box>
      )}

      {inProgressTasks.length > 0 && (
        <box flexDirection="column" paddingLeft={1}>
          {inProgressTasks.map((task) => (
            <box key={task.id} flexDirection="row" gap={1}>
              <text fg={BRAND.info}>▸</text>
              <text fg={BRAND.purple}>
                <strong>{task.id}</strong>
              </text>
              <text fg={BRAND.fgDim}>{`[${task.track}]`}</text>
              <text fg={BRAND.fg}>{task.title}</text>
            </box>
          ))}
        </box>
      )}

      {runningSession.lastEventAt && (
        <box paddingLeft={1}>
          <text fg={BRAND.fgDim}>
            {`Last event: ${runningSession.lastEventAt.slice(11, 19)}`}
          </text>
        </box>
      )}
    </box>
  );
}
