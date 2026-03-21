import { BRAND, TITLE, VERSION } from "../brand.js";
import type { ProjectMeta } from "../../workspace/types.js";
import type { TaskCounts } from "../state.js";

interface HeaderProps {
  width: number;
  project: ProjectMeta | null;
  taskCounts: TaskCounts;
}

export function Header({ width, project, taskCounts }: HeaderProps) {
  const c = taskCounts;
  const statusText = project
    ? `${c.total}T ${c.ready}R ${c.done}D ${c.failed}F`
    : "NO PROJECT";

  const projectText = project ? project.name : "—";

  return (
    <box
      width={width}
      height={3}
      backgroundColor={BRAND.card}
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      border
      borderStyle="single"
      borderColor={BRAND.purple}
    >
      {/* Logo + title */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={BRAND.purple}>
          <strong>{"■ "}{TITLE}</strong>
        </text>
        <text fg={BRAND.fgDim}>{` v${VERSION}`}</text>
      </box>

      {/* Project name */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={BRAND.fgDim}>{"PROJECT "}</text>
        <text fg={BRAND.fg}>
          <strong>{projectText}</strong>
        </text>
      </box>

      {/* Status counters */}
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={BRAND.fgDim}>{statusText}</text>
      </box>
    </box>
  );
}
