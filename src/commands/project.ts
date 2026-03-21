import { resolve } from "node:path";
import { WorkspaceManager } from "../workspace/manager.js";
import { initProject, importProject } from "../ai/project-init.js";
import { log } from "../utils/logger.js";

// ── Project CLI Commands ────────────────────────────────────

const ws = new WorkspaceManager();

export async function cmdProjectInit(args: string[]): Promise<void> {
  const repo = flagValue(args, "repo") ?? process.cwd();
  const name = flagValue(args, "name");
  const provider = (flagValue(args, "provider") ?? "claude") as
    | "claude"
    | "codex";
  const plan = flagValue(args, "plan");
  const validatedPlan = flagValue(args, "validated-plan");

  try {
    const meta = await initProject({
      repo,
      name,
      provider,
      plan,
      validatedPlan,
    });

    log.divider();
    log.success(`Project created: ${meta.id}`);
    log.info(`  Location: ${ws.getProjectPath(meta.id)}`);
    log.info(`  Repo: ${meta.repoRoot}`);
    log.info(`  Provider: ${meta.provider}`);
    log.divider();
    log.info(`Run \`qap ui\` to open the TUI, or \`qap status\` to check state.`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function cmdProjectImport(args: string[]): Promise<void> {
  const repo = flagValue(args, "repo") ?? process.cwd();
  const name = flagValue(args, "name");
  const provider = (flagValue(args, "provider") ?? "claude") as
    | "claude"
    | "codex";
  const prompts = flagValue(args, "prompts");
  const linearIssue = flagValue(args, "linear-issue");

  try {
    const meta = await importProject({
      repo,
      name,
      provider,
      prompts,
      linearIssue,
    });

    log.divider();
    log.success(`Project imported: ${meta.id}`);
    log.info(`  Location: ${ws.getProjectPath(meta.id)}`);
    log.info(`  Repo: ${meta.repoRoot}`);
    log.info(`  Provider: ${meta.provider}`);
    log.divider();
    log.info(`Run \`qap ui\` to open the TUI, or \`qap status\` to check state.`);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function cmdProjectList(): Promise<void> {
  const projects = await ws.listProjects();
  const activeId = await ws.getActiveProjectId();

  if (projects.length === 0) {
    log.info("No projects found.");
    log.info("Run `qap project init` or `qap project import` to get started.");
    return;
  }

  console.log();
  console.log(
    "  \x1b[35m\x1b[1mQUESTPIE AUTOPILOT\x1b[0m — Projects"
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
  const projectId = args[0];

  if (!projectId) {
    log.error("Usage: qap project use <project-id>");
    return;
  }

  const exists = await ws.projectExists(projectId);
  if (!exists) {
    log.error(`Project "${projectId}" not found.`);
    const projects = await ws.listProjects();
    if (projects.length > 0) {
      log.info(
        `Available: ${projects.map((p) => p.id).join(", ")}`
      );
    }
    return;
  }

  await ws.setActiveProject(projectId);
  log.success(`Active project set to "${projectId}"`);
}

// ── Helpers ──

function flagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}
