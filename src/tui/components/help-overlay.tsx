import { BRAND } from "../brand.js";

interface HelpOverlayProps {
  width: number;
  height: number;
  onClose: () => void;
}

const COMMANDS = [
  ["/project init [--repo path]", "Initialize a new project (AI-assisted)"],
  ["/project import [--repo path]", "Import existing project artifacts"],
  ["/project use <id>", "Switch active project"],
  ["/project list", "List all projects"],
  ["/sessions", "Show session history"],
  ["/session show <id>", "Show session details"],
  ["/session latest", "Show most recent session"],
  ["/session current", "Show running session"],
  ["/run", "Run next ready task (creates session)"],
  ["/run-next", "Run next ready task (creates session)"],
  ["/run-task <id>", "Run a specific task (creates session)"],
  ["/retry <id>", "Retry a failed task (creates session)"],
  ["/status", "Show task counts"],
  ["/note <id> <text>", "Add note to a task"],
  ["/note show <id>", "Show task notes"],
  ["/steer project <text>", "Add project steering note"],
  ["/steer show", "Show project steering notes"],
  ["/refresh", "Reload project state"],
  ["/help", "Toggle this help"],
] as const;

const KEYS = [
  ["1-4", "Switch tabs (Project/Sessions/Logs/Help)"],
  ["Ctrl+L", "Refresh state"],
  ["ESC", "Close overlay / go back"],
  ["Enter", "Submit command"],
  ["Tab", "Accept autocomplete suggestion"],
  ["Up/Down", "Navigate suggestions / command history"],
  ["j/k", "Navigate session list"],
  ["Ctrl+C", "Exit"],
] as const;

export function HelpOverlay({ width, height }: HelpOverlayProps) {
  const boxW = Math.min(72, width - 4);

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
          <strong>SLASH COMMANDS</strong>
        </text>
        <text fg={BRAND.fgMuted}>{"Autocomplete: type / then Tab to complete"}</text>
        {COMMANDS.map(([cmd, desc]) => (
          <box key={cmd} flexDirection="row">
            <text fg={BRAND.fg}>
              <strong>{cmd.padEnd(32)}</strong>
            </text>
            <text fg={BRAND.fgDim}>{desc}</text>
          </box>
        ))}

        <text fg={BRAND.purple}>
          <strong>{"\nKEYBOARD"}</strong>
        </text>
        {KEYS.map(([key, desc]) => (
          <box key={key} flexDirection="row">
            <text fg={BRAND.fg}>
              <strong>{key.padEnd(32)}</strong>
            </text>
            <text fg={BRAND.fgDim}>{desc}</text>
          </box>
        ))}

        <text fg={BRAND.fgMuted}>{"\nPress ESC to close"}</text>
      </box>
    </box>
  );
}
