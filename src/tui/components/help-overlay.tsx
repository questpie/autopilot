import { BRAND } from "../brand.js";

interface HelpOverlayProps {
  width: number;
  height: number;
  onClose: () => void;
}

const COMMANDS = [
  ["/init [repo-path]", "Initialize a new project from repo"],
  ["/project import [repo]", "Import existing project artifacts"],
  ["/project use <id>", "Switch active project"],
  ["/project list", "List all projects"],
  ["/run", "Run next ready task"],
  ["/run-task <id>", "Run a specific task"],
  ["/status", "Show task counts"],
  ["/refresh", "Reload project state"],
  ["/help", "Toggle this help"],
] as const;

const KEYS = [
  ["ESC", "Close help / cancel"],
  ["Enter", "Submit command"],
] as const;

export function HelpOverlay({ width, height }: HelpOverlayProps) {
  const boxW = Math.min(60, width - 4);

  return (
    <box
      width={width}
      height={height}
      position="absolute"
      left={0}
      top={0}
      justifyContent="center"
      alignItems="center"
    >
      <box
        width={boxW}
        border
        borderStyle="single"
        borderColor={BRAND.purple}
        backgroundColor={BRAND.card}
        title=" HELP "
        titleAlignment="center"
        flexDirection="column"
        padding={1}
        gap={1}
      >
        <text fg={BRAND.purple}>
          <strong>COMMANDS</strong>
        </text>
        {COMMANDS.map(([cmd, desc]) => (
          <box key={cmd} flexDirection="row">
            <text fg={BRAND.fg}>
              <strong>{cmd.padEnd(24)}</strong>
            </text>
            <text fg={BRAND.fgDim}>{desc}</text>
          </box>
        ))}

        <text fg={BRAND.purple}>
          <strong>{"\nKEYS"}</strong>
        </text>
        {KEYS.map(([key, desc]) => (
          <box key={key} flexDirection="row">
            <text fg={BRAND.fg}>
              <strong>{key.padEnd(24)}</strong>
            </text>
            <text fg={BRAND.fgDim}>{desc}</text>
          </box>
        ))}

        <text fg={BRAND.fgMuted}>{"\nPress ESC to close"}</text>
      </box>
    </box>
  );
}
