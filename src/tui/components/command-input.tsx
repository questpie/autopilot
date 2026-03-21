import { useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { BRAND } from "../brand.js";

interface CommandInputProps {
  width: number;
  onSubmit: (cmd: string) => void;
}

export function CommandInput({ width, onSubmit }: CommandInputProps) {
  const [value, setValue] = useState("");
  const renderer = useRenderer();

  // ESC → clear input, Ctrl+C → exit
  useKeyboard((key) => {
    if (key.name === "escape" && value.length > 0) {
      setValue("");
    }
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
    }
  });

  const handleSubmit = (v: string) => {
    const trimmed = v.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setValue("");
    }
  };

  return (
    <box
      width={width}
      height={3}
      flexDirection="column"
      backgroundColor={BRAND.surface}
      border
      borderStyle="single"
      borderColor={BRAND.purple}
    >
      <box flexDirection="row" alignItems="center">
        <text fg={BRAND.purple}>
          <strong>{" ▸ "}</strong>
        </text>
        <input
          width={width - 6}
          value={value}
          onChange={(v: string) => setValue(v)}
          onSubmit={handleSubmit as any}
          placeholder="Type a command... (/help)  ESC clear · Ctrl+C exit"
          backgroundColor={BRAND.surface}
          focusedBackgroundColor={BRAND.card}
          textColor={BRAND.fg}
          cursorColor={BRAND.purple}
          placeholderColor={BRAND.fgMuted}
          focused
        />
      </box>
    </box>
  );
}
