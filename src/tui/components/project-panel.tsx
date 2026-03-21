import { BRAND } from "../brand.js";
import type { WorkspaceMeta, ProjectMeta } from "../../workspace/types.js";

interface ProjectPanelProps {
  width: number;
  height: number;
  workspace: WorkspaceMeta | null;
  project: ProjectMeta | null;
}

export function ProjectPanel({
  width,
  height,
  workspace,
  project,
}: ProjectPanelProps) {
  if (!project) {
    return (
      <box
        width={width}
        height={height}
        border
        borderStyle="single"
        borderColor={BRAND.border}
        title=" PROJECT "
        titleAlignment="left"
        backgroundColor={BRAND.card}
        flexDirection="column"
        padding={1}
      >
        <text fg={BRAND.fgDim}>No project selected</text>
        <text fg={BRAND.fgMuted}>{""}</text>
        {workspace ? (
          <>
            <text fg={BRAND.fgDim}>
              {"Workspace: "}{workspace.name}
            </text>
            <text fg={BRAND.fgMuted}>{""}</text>
          </>
        ) : null}
        <text fg={BRAND.purple}>Type /project init to create a project</text>
        <text fg={BRAND.purple}>{"  or /project import to import one"}</text>
      </box>
    );
  }

  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.purple}
      title=" PROJECT "
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
      padding={1}
    >
      <box flexDirection="row" gap={1}>
        <text fg={BRAND.fgDim}>{"Name    "}</text>
        <text fg={BRAND.fg}>
          <strong>{project.name}</strong>
        </text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={BRAND.fgDim}>{"ID      "}</text>
        <text fg={BRAND.fg}>{project.id}</text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={BRAND.fgDim}>{"Provider"}</text>
        <text fg={BRAND.info}>{project.provider}</text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={BRAND.fgDim}>{"Repo    "}</text>
        <text fg={BRAND.fg}>{project.repoRoot}</text>
      </box>
      <box flexDirection="row" gap={1}>
        <text fg={BRAND.fgDim}>{"Mode    "}</text>
        <text fg={BRAND.fg}>{project.source?.mode ?? "—"}</text>
      </box>
      {workspace ? (
        <box flexDirection="row" gap={1}>
          <text fg={BRAND.fgDim}>{"Workspace"}</text>
          <text fg={BRAND.fgMuted}>{workspace.name}</text>
        </box>
      ) : null}
    </box>
  );
}
