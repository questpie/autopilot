/**
 * Default preinstalled skill catalog.
 *
 * Canonical skill records live in the DB config registry; local SKILL.md
 * files are materialized through `agent-install`, not stored as product
 * truth here.
 *
 * The catalog is idempotent: running the seed twice never overwrites a
 * skill that already has a record. Operators can edit any of these in
 * Settings without fear of losing their changes on the next start-up.
 *
 * Built-in availability:
 *   - `built_in`: always-available, ships with Autopilot.
 *   - `plugin_backed`: resolved at runtime; UI shows availability state
 *     (`available` / `missing` / `needs_install`) instead of pretending
 *     they are installed locally.
 */
import type { SkillEntry } from '@questpie/autopilot-spec'
import type { ConfigService } from './config-service'

export type SkillAvailability = 'built_in' | 'plugin_backed'

export interface DefaultSkillSeed {
	id: string
	availability: SkillAvailability
	manifest: {
		name: string
		description: string
		tags: string[]
		roles: string[]
	}
	body: string
}

const DEFAULT_SKILLS: DefaultSkillSeed[] = [
	{
		id: 'skill-creator',
		availability: 'built_in',
		manifest: {
			name: 'skill-creator',
			description:
				'Author new agent skills as concise progressive-disclosure SKILL.md packages. Use when adding or rewriting a capability for an Autopilot agent.',
			tags: ['authoring', 'skills', 'meta'],
			roles: ['developer', 'reviewer', 'planner'],
		},
		body: `# skill-creator

Create or update Autopilot skills as concise progressive-disclosure SKILL.md
packages. The agent is responsible for naming, scope, and trigger phrasing.

## When to use

Activate when the operator asks to add, rewrite, or split an agent skill.

## Output shape

A skill should contain:

- frontmatter: name, description, tags, roles
- short overview (1-3 sentences)
- when-to-use guidance
- worked example or recipe
- failure modes / what NOT to do
`,
	},
	{
		id: 'skill-installer',
		availability: 'built_in',
		manifest: {
			name: 'skill-installer',
			description:
				'Install curated skills from the Autopilot catalog or pull skills from a GitHub repo path. Use when operators ask to "add a skill" or extend an agent capability profile.',
			tags: ['skills', 'install', 'catalog'],
			roles: ['developer', 'planner'],
		},
		body: `# skill-installer

Install skills into the company catalog. Source can be:

- a curated catalog id
- a GitHub URL (owner/repo[#ref])
- a local path inside an agent-install workspace

## Steps

1. Resolve source.
2. Validate the SKILL.md frontmatter.
3. Add a config_skills record (idempotent).
4. Optionally trigger \`agent-install\` to materialize for local clients.
`,
	},
	{
		id: 'github',
		availability: 'plugin_backed',
		manifest: {
			name: 'github',
			description:
				'GitHub triage and repository orientation. Reads PRs, issues, and CI runs through the GitHub adapter. Use when working in a project with a GitHub remote.',
			tags: ['github', 'triage', 'repo'],
			roles: ['developer', 'reviewer'],
		},
		body: `# github

Operate against a GitHub-backed project. Requires the GitHub provider to
be configured.

Capabilities:

- list/read issues and PRs
- inspect CI runs and PR checks
- post comments through the provider, never directly
`,
	},
	{
		id: 'gh-fix-ci',
		availability: 'plugin_backed',
		manifest: {
			name: 'gh-fix-ci',
			description:
				'Inspect failing GitHub Actions for the active PR/branch and propose or apply fixes. Use when CI is red and the operator asks to fix it.',
			tags: ['github', 'ci', 'fix'],
			roles: ['developer'],
		},
		body: `# gh-fix-ci

Diagnose and propose fixes for failing GitHub Actions runs.

Pre-conditions:

- project has a GitHub remote
- the failing run is reachable via the GitHub provider
`,
	},
	{
		id: 'gh-address-comments',
		availability: 'plugin_backed',
		manifest: {
			name: 'gh-address-comments',
			description:
				'Address actionable PR review comments by drafting code changes and reply replies. Use when operators want to respond to PR feedback in bulk.',
			tags: ['github', 'review', 'pr'],
			roles: ['developer', 'reviewer'],
		},
		body: `# gh-address-comments

Walk the open review comments on the active PR, classify each as actionable
or informational, draft code changes for actionable ones, and queue reply
text for informational ones.
`,
	},
	{
		id: 'knowledge-authoring',
		availability: 'built_in',
		manifest: {
			name: 'knowledge-authoring',
			description:
				'Create and maintain markdown, OpenAPI, image, and document Knowledge artifacts. Use whenever a run produces a durable artifact that should land in Knowledge.',
			tags: ['knowledge', 'authoring', 'artifacts'],
			roles: ['developer', 'reviewer', 'planner', 'researcher'],
		},
		body: `# knowledge-authoring

Author Knowledge resources rather than ad-hoc files. Always go through the
Knowledge API; never bypass it for company/project resource truth.

Choose the renderer that matches the resource kind: markdown for prose,
yaml for OpenAPI/configs, document/image for media.
`,
	},
	{
		id: 'project-run-review',
		availability: 'built_in',
		manifest: {
			name: 'project-run-review',
			description:
				'Inspect ephemeral git workspace diffs, test output, commits, and provider metadata for a finished run. Use when operators ask "what changed?" or want to review a worker run.',
			tags: ['review', 'diff', 'run'],
			roles: ['reviewer', 'developer'],
		},
		body: `# project-run-review

Project run inspection is read-only. Use the workspace inspection API to
list changed files, render diffs, and surface provider PR/MR metadata.

Do not edit the workspace directly. Edits happen inside worker runs.
`,
	},
	{
		id: 'frontend-qa',
		availability: 'built_in',
		manifest: {
			name: 'frontend-qa',
			description:
				'Run operator-web typecheck, build, and Playwright E2E flows; report any console/page errors. Use when verifying a UI change before declaring done.',
			tags: ['qa', 'frontend', 'playwright'],
			roles: ['reviewer', 'developer'],
		},
		body: `# frontend-qa

Verify operator-web changes:

1. typecheck (\`bun run --cwd apps/operator-web typecheck\`)
2. lint where configured
3. Playwright E2E (\`bun run --cwd apps/operator-web test:e2e\`)
4. report regressions with screenshots/network/console signal
`,
	},
]

export interface SeedDefaultSkillsResult {
	inserted: string[]
	skipped: string[]
}

export function listDefaultSkills(): readonly DefaultSkillSeed[] {
	return DEFAULT_SKILLS
}

function buildSkillEntry(seed: DefaultSkillSeed): SkillEntry {
	return {
		id: seed.id,
		manifest: {
			name: seed.manifest.name,
			description: seed.manifest.description,
			version: '',
			tags: seed.manifest.tags,
			roles: seed.manifest.roles,
			scripts: [],
		},
		body: seed.body,
		path: `db://skills/${seed.id}/SKILL.md`,
	}
}

/**
 * Idempotently insert the default skill catalog into company-scope config.
 * Existing records are never overwritten — operators may have already
 * customized the manifest or body.
 */
export async function seedDefaultSkills(
	configService: ConfigService,
): Promise<SeedDefaultSkillsResult> {
	const inserted: string[] = []
	const skipped: string[] = []

	for (const seed of DEFAULT_SKILLS) {
		const existing = await configService.get('skills', seed.id, null)
		if (existing) {
			skipped.push(seed.id)
			continue
		}
		await configService.set('skills', seed.id, buildSkillEntry(seed), null)
		inserted.push(seed.id)
	}

	return { inserted, skipped }
}
