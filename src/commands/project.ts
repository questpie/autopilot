import { WorkspaceManager } from "../workspace/manager.js";
import { initProject, importProject } from "../ai/project-init.js";
import { log } from "../utils/logger.js";

// ── Project CLI Commands ────────────────────────────────────

const ws = new WorkspaceManager();

export function printProjectHelp(): void {
  console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap project\x1b[0m — manage projects within the current workspace

Commands:
  qap project init              Initialize new project (AI-assisted)
  qap project import            Import existing project artifacts
  qap project list              List all projects in current workspace
  qap project use <id>          Set active project

Options:
  --repo <path>                 Target repo path (default: cwd)
  --name <name>                 Project name
  --provider <claude|codex>     Agent provider (default: claude)
  --plan <file>                 Plan artifact for init
  --validated-plan <file>       Validated plan for init
  --prompts <dir>               Prompt directory for import
  --linear-issue <url>          Linear issue for import
  --degraded-import             Allow AI/fallback import (no backlog.json)
  --help                        Show this help
`);
}

export async function cmdProjectInit(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap project init\x1b[0m — initialize a new project (AI-assisted)

Usage: qap project init [options]

Options:
  --repo <path>                 Target repo path (default: cwd)
  --name <name>                 Project name (default: inferred from repo)
  --provider <claude|codex>     Agent provider (default: claude)
  --plan <file>                 Plan artifact file
  --validated-plan <file>       Validated plan artifact file
  --help                        Show this help

The init command spawns an AI agent that reads your repo and planning
artifacts to generate the local project workspace (config, prompts,
handoff doc). If the agent is unavailable, a fallback config is created.
`);
    return;
  }

  const repo = flagValue(args, "repo") ?? process.cwd();
  const name = flagValue(args, "name");
  const provider = (flagValue(args, "provider") ?? "claude") as
    | "claude"
    | "codex";
  const plan = flagValue(args, "plan");
  const validatedPlan = flagValue(args, "validated-plan");

  try {
    const { meta, workspaceId } = await initProject({
      repo,
      name,
      provider,
      plan,
      validatedPlan,
    });

    log.divider();
    log.success(`Project created: ${meta.id}`);
    log.info(`  Location: ${ws.getProjectPath(workspaceId, meta.id)}`);
    log.info(`  Workspace: ${workspaceId}`);
    log.info(`  Repo: ${meta.repoRoot}`);
    log.info(`  Provider: ${meta.provider}`);
    log.divider();
    log.info(`Run \`qap\` to open the TUI, or \`qap status\` to check state.`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function cmdProjectImport(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap project import\x1b[0m — import existing project artifacts (AI-assisted)

Usage: qap project import [options]

Options:
  --repo <path>                 Target repo path (default: cwd)
  --name <name>                 Project name (default: inferred from repo)
  --provider <claude|codex>     Agent provider (default: claude)
  --prompts <dir>               Directory containing prompt files
  --linear-issue <url>          Linear issue URL for context
  --degraded-import             Allow AI/fallback import when no backlog.json
  --help                        Show this help

Import uses backlog.json as machine truth when present. If backlog.json
exists but is invalid, the import fails hard. Without backlog.json,
import requires --degraded-import to proceed with AI/fallback mode.
`);
    return;
  }

  const repo = flagValue(args, "repo") ?? process.cwd();
  const name = flagValue(args, "name");
  const provider = (flagValue(args, "provider") ?? "claude") as
    | "claude"
    | "codex";
  const prompts = flagValue(args, "prompts");
  const linearIssue = flagValue(args, "linear-issue");
  const degradedImport = args.includes("--degraded-import");

  try {
    const { meta, workspaceId } = await importProject({
      repo,
      name,
      provider,
      prompts,
      linearIssue,
      degradedImport,
    });

    log.divider();
    log.success(`Project imported: ${meta.id}`);
    log.info(`  Location: ${ws.getProjectPath(workspaceId, meta.id)}`);
    log.info(`  Workspace: ${workspaceId}`);
    log.info(`  Repo: ${meta.repoRoot}`);
    log.info(`  Provider: ${meta.provider}`);
    log.divider();
    log.info(`Run \`qap\` to open the TUI, or \`qap status\` to check state.`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function cmdProjectList(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap project list\x1b[0m — list projects in the current workspace

Usage: qap project list [--help]

Lists all projects in the workspace resolved from the current
working directory. If no workspace is found, shows all workspaces.
`);
    return;
  }

  const workspace = await ws.resolveWorkspaceFromCwd();

  if (!workspace) {
    // Show all workspaces instead
    const workspaces = await ws.listWorkspaces();
    if (workspaces.length === 0) {
      log.info("No workspaces found.");
      log.info("Run `qap project init` or `qap project import` from a repo to get started.");
      return;
    }

    console.log();
    console.log(
      "  \x1b[35m\x1b[1mQUESTPIE AUTOPILOT\x1b[0m — Workspaces"
    );
    console.log();
    for (const w of workspaces) {
      const projects = await ws.listProjects(w.id);
      console.log(
        `  ${w.name.padEnd(24)} ${String(projects.length).padEnd(4)} projects  ${w.repoRoot}`
      );
    }
    console.log();
    log.info("cd into a workspace repo to see its projects.");
    return;
  }

  const projects = await ws.listProjects(workspace.id);
  const activeId = workspace.activeProject;

  if (projects.length === 0) {
    log.info(`No projects in workspace "${workspace.name}".`);
    log.info("Run `qap project init` or `qap project import` to get started.");
    return;
  }

  console.log();
  console.log(
    `  \x1b[35m\x1b[1mQUESTPIE AUTOPILOT\x1b[0m — ${workspace.name} — Projects`
  );
  console.log();

  for (const p of projects) {
    const active = p.id === activeId ? " \x1b[35m● active\x1b[0m" : "";
    const mode = p.source?.mode ?? "unknown";
    console.log(
      `  ${p.id.padEnd(24)} ${mode.padEnd(8)} ${p.provider.padEnd(8)} ${p.repoRoot}${active}`
    );
  }

  console.log();
}

export async function cmdProjectUse(args: string[]): Promise<void> {
  if (hasFlag(args, "help")) {
    console.log(`
\x1b[38;2;183;0;255m■\x1b[0m \x1b[1mqap project use\x1b[0m — set the active project

Usage: qap project use <project-id> [--help]

Sets which project is active in the current workspace.
The active project is loaded automatically when you run \`qap\`.
`);
    return;
  }

  const projectId = args.find((a) => !a.startsWith("--"));

  if (!projectId) {
    log.error("Usage: qap project use <project-id>");
    return;
  }

  const workspace = await ws.resolveWorkspaceFromCwd();
  if (!workspace) {
    log.error("No workspace found for current directory.");
    log.info("Run `qap project init` or `qap project import` first.");
    return;
  }

  const exists = await ws.projectExists(workspace.id, projectId);
  if (!exists) {
    log.error(`Project "${projectId}" not found in workspace "${workspace.name}".`);
    const projects = await ws.listProjects(workspace.id);
    if (projects.length > 0) {
      log.info(
        `Available: ${projects.map((p) => p.id).join(", ")}`
      );
    }
    return;
  }

  await ws.setActiveProject(workspace.id, projectId);
  log.success(`Active project set to "${projectId}"`);
}

// ── Helpers ──

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`) || args.includes(`--help`);
}
