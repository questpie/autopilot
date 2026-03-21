import { BRAND } from "../brand.js";
import type { TaskEntry } from "../state.js";

interface TasksPanelProps {
  width: number;
  height: number;
  title: string;
  tasks: TaskEntry[];
  emptyText: string;
  statusColor: string;
}

function stateIcon(state: string): string {
  switch (state) {
    case "done":
    case "committed":
      return "✓";
    case "failed":
      return "✗";
    case "in_progress":
      return "▸";
    case "blocked":
      return "#";
    case "ready":
      return "●";
    default:
      return "·";
  }
}

function stateColor(state: string): string {
  switch (state) {
    case "done":
    case "committed":
      return BRAND.success;
    case "failed":
      return BRAND.error;
    case "in_progress":
      return BRAND.info;
    case "blocked":
      return BRAND.warning;
    case "ready":
      return BRAND.purple;
    default:
      return BRAND.fgDim;
  }
}

export function TasksPanel({
  width,
  height,
  title,
  tasks,
  emptyText,
}: TasksPanelProps) {
  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.border}
      title={` ${title} `}
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      {tasks.length === 0 ? (
        <box padding={1}>
          <text fg={BRAND.fgDim}>{emptyText}</text>
        </box>
      ) : (
        <scrollbox>
          {tasks.map((task) => (
            <box key={task.id} flexDirection="row" gap={1}>
              <text fg={stateColor(task.state)}>
                {stateIcon(task.state)}
              </text>
              <text fg={BRAND.purple}>
                <strong>{task.id.padEnd(10)}</strong>
              </text>
              <text fg={BRAND.fgDim}>{`[${task.track}]`}</text>
              <text fg={BRAND.fg}>{task.title}</text>
            </box>
          ))}
        </scrollbox>
      )}
    </box>
  );
}
