import { BRAND } from "../brand.js";
import type { ProjectMeta } from "../../workspace/types.js";

interface ProjectPickerProps {
  width: number;
  height: number;
  projects: ProjectMeta[];
  activeId?: string;
}

export function ProjectPicker({
  width,
  height,
  projects,
  activeId,
}: ProjectPickerProps) {
  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.purple}
      title=" SELECT PROJECT "
      titleAlignment="center"
      backgroundColor={BRAND.card}
      flexDirection="column"
      padding={1}
    >
      <text fg={BRAND.fg}>
        <strong>Multiple projects found. Select one:</strong>
      </text>
      <text fg={BRAND.fgMuted}>{""}</text>
      {projects.map((p) => (
        <box key={p.id} flexDirection="row" gap={1}>
          <text fg={p.id === activeId ? BRAND.purple : BRAND.fgDim}>
            {p.id === activeId ? "● " : "  "}
          </text>
          <text fg={BRAND.fg}>
            <strong>{p.id.padEnd(20)}</strong>
          </text>
          <text fg={BRAND.info}>{p.provider.padEnd(8)}</text>
          <text fg={BRAND.fgDim}>{p.source?.mode ?? "—"}</text>
        </box>
      ))}
      <text fg={BRAND.fgMuted}>{""}</text>
      <text fg={BRAND.purple}>
        {"Type /project use <id> to select"}
      </text>
    </box>
  );
}
