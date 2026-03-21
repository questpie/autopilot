import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.js";

export async function launchTui(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false, // We handle Ctrl+Q for exit
  });

  createRoot(renderer).render(<App />);
}
