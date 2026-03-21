import { BRAND } from "../brand.js";

interface LogPanelProps {
  width: number;
  height: number;
  logs: string[];
}

export function LogPanel({ width, height, logs }: LogPanelProps) {
  return (
    <box
      width={width}
      height={height}
      border
      borderStyle="single"
      borderColor={BRAND.border}
      title=" LOG "
      titleAlignment="left"
      backgroundColor={BRAND.card}
      flexDirection="column"
    >
      <scrollbox>
        {logs.map((line, i) => (
          <text key={i} fg={BRAND.fgDim}>
            {line}
          </text>
        ))}
      </scrollbox>
    </box>
  );
}
