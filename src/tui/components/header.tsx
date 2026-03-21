import { BRAND, TITLE, VERSION } from "../brand.js";
import type { WorkspaceMeta, ProjectMeta } from "../../workspace/types.js";
import type { TaskCounts, TuiView } from "../state.js";

interface HeaderProps {
  width: number;
  workspace: WorkspaceMeta | null;
  project: ProjectMeta | null;
  taskCounts: TaskCounts;
  activeView: TuiView;
  updateStatus?: string | null;
}

export function Header({
  width,
  workspace,
  project,
  taskCounts,
  activeView,
  updateStatus,
}: HeaderProps) {
  const c = taskCounts;
  const statusText = project
    ? `${c.total}T ${c.ready}R ${c.done}D ${c.failed}F`
    : "NO PROJECT";

  const wsText = workspace ? workspace.name : "—";
  const projText = project ? project.name : "—";

  const tabs: TuiView[] = ["project", "sessions", "logs", "help"];
  const tabLabel = (tab: TuiView): string => {
    if (tab === "sessions" && activeView === "session-detail") return "SESSION";
    return tab.toUpperCase();
  };

  return (
    <box
      width={width}
      height={3}
      backgroundColor={BRAND.card}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={BRAND.purple}
    >
      {/* Top row: logo + workspace + project + status */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row" gap={1} alignItems="center">
          <text fg={BRAND.purple}>
            <strong>{"■ "}{TITLE}</strong>
          </text>
          <text fg={BRAND.fgDim}>{`v${VERSION}`}</text>
          <text fg={BRAND.fgMuted}>{"│"}</text>
          <text fg={BRAND.fgDim}>{"WS "}</text>
          <text fg={BRAND.fg}>{wsText}</text>
          <text fg={BRAND.fgMuted}>{"│"}</text>
          <text fg={BRAND.fgDim}>{"PRJ "}</text>
          <text fg={BRAND.fg}>
            <strong>{projText}</strong>
          </text>
        </box>

        <box flexDirection="row" gap={1} alignItems="center">
          {updateStatus && (
            <text fg={BRAND.warning}>{updateStatus}</text>
          )}
          <text fg={BRAND.fgDim}>{statusText}</text>
        </box>
      </box>

      {/* Tab bar */}
      <box flexDirection="row" gap={2}>
        {tabs.map((tab) => {
          const isActive = tab === activeView || (tab === "sessions" && activeView === "session-detail");
          return (
            <text
              key={tab}
              fg={isActive ? BRAND.purple : BRAND.fgMuted}
            >
              {isActive ? (
                <strong>{` [${tabLabel(tab)}] `}</strong>
              ) : (
                `  ${tabLabel(tab)}  `
              )}
            </text>
          );
        })}
      </box>
    </box>
  );
}
