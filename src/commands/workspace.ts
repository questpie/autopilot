import { resolve } from "node:path";
import { WorkspaceManager } from "../workspace/manager.js";
import { log } from "../utils/logger.js";

// ── Workspace CLI Commands ──────────────────────────────────

const ws = new WorkspaceManager();

export function printWorkspaceHelp(): void {
  console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap workspace\x1b[0m — manage workspaces

Commands:
  qap workspace add <path>      Register a repo as a workspace
  qap workspace list            List all known workspaces
  qap workspace show            Show current workspace info

Options:
  --help                        Show this help
`);
}

export async function cmdWorkspaceAdd(args: string[]): Promise<void> {
  const repoPath = args.find((a) => !a.startsWith("--"));

  if (!repoPath) {
    log.error("Usage: qap workspace add <repo-path>");
    return;
  }

  const absPath = resolve(repoPath);
  const workspace = await ws.ensureWorkspace(absPath);
  log.success(`Workspace "${workspace.name}" registered (${workspace.id})`);
  log.info(`  Repo: ${workspace.repoRoot}`);
}

export async function cmdWorkspaceList(): Promise<void> {
  const workspaces = await ws.listWorkspaces();

  if (workspaces.length === 0) {
    log.info("No workspaces found.");
    log.info("Run `qap project init` from a repo to create one automatically.");
    return;
  }

  console.log();
  console.log(
    "  \x1b[35m\x1b[1mQUESTPIE AUTOPILOT\x1b[0m — Workspaces"
  );
  console.log();

  for (const w of workspaces) {
    const projects = await ws.listProjects(w.id);
    const activeTag = w.activeProject ? ` [active: ${w.activeProject}]` : "";
    console.log(
      `  ${w.name.padEnd(24)} ${String(projects.length).padEnd(3)} projects  ${w.repoRoot}${activeTag}`
    );
  }

  console.log();
}

export async function cmdWorkspaceShow(): Promise<void> {
  const workspace = await ws.resolveWorkspaceFromCwd();

  if (!workspace) {
    log.info("No workspace found for current directory.");
    log.info("Run `qap workspace add .` or `qap project init` to register one.");
    return;
  }

  const projects = await ws.listProjects(workspace.id);

  console.log();
  console.log(
    `  \x1b[35m\x1b[1mWorkspace:\x1b[0m ${workspace.name}`
  );
  console.log(`  ID:       ${workspace.id}`);
  console.log(`  Repo:     ${workspace.repoRoot}`);
  console.log(`  Active:   ${workspace.activeProject ?? "none"}`);
  console.log(`  Projects: ${projects.length}`);

  if (projects.length > 0) {
    console.log();
    for (const p of projects) {
      const active = p.id === workspace.activeProject ? " ●" : "";
      console.log(`    ${p.id.padEnd(24)} ${p.provider}${active}`);
    }
  }

  console.log();
}
