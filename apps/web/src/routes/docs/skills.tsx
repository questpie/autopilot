import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/skills')({
	head: () => ({ ...seoHead({ title: 'Skills', description: 'Markdown knowledge packages in agentskills.io format. Skill templates, creating custom skills, and 3-stage lazy loading.', path: '/docs/skills', ogImage: 'https://autopilot.questpie.com/og-skills.png' }) }),
	component: Skills,
})

function Skills() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Skills
			</h1>
			<p className="text-muted text-lg mb-8">
				Markdown knowledge packages that teach agents domain expertise.
				Like Claude Code skills, but for company agents. Based on the
				open{' '}
				<code className="font-mono text-xs text-purple">
					agentskills.io
				</code>{' '}
				standard.
			</p>

			{/* ── What Are Skills ────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What Are Skills
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Skills are packaged knowledge documents with optional scripts
				and references that teach agents how to do specific things.
				Code review conventions, deployment checklists, API design
				patterns, incident response playbooks -- anything an agent
				needs to know is a skill.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				Skills follow the{' '}
				<code className="font-mono text-xs text-purple">
					agentskills.io
				</code>{' '}
				open standard: a directory with a{' '}
				<code className="font-mono text-xs text-purple">SKILL.md</code>{' '}
				file containing YAML frontmatter and markdown body.
			</p>

			{/* ── Skill Format ───────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Skill Format
			</h2>
			<CodeBlock title="directory-structure">
				{`skills/
├── code-review/
│   ├── SKILL.md              # Main knowledge document
│   ├── scripts/              # Optional automation scripts
│   │   └── lint-check.sh
│   ├── references/           # Optional reference materials
│   │   └── style-guide.md
│   └── assets/               # Optional images, templates
│       └── checklist.md
├── deployment/
│   └── SKILL.md
└── git-workflow/
    └── SKILL.md`}
			</CodeBlock>

			<h3 className="font-sans text-base font-bold text-white mt-6 mb-3">
				SKILL.md Frontmatter
			</h3>
			<CodeBlock title="skills/code-review/SKILL.md">
				{`---
name: code-review
description: |
  Code review standards, checklist, and conventions.
  Use when reviewing PRs or providing code feedback.
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [code-quality, review, standards]
  roles: [reviewer, developer]
---

# Code Review

## When to Use
When reviewing pull requests or providing code feedback...

## Checklist
- [ ] No security vulnerabilities (OWASP top 10)
- [ ] Tests cover happy path and edge cases
- [ ] No hardcoded secrets or credentials
...`}
			</CodeBlock>
			<p className="text-ghost leading-relaxed mb-4">
				Key frontmatter fields:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Field
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Required
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">name</td>
							<td className="py-2 pr-4 text-xs">Yes</td>
							<td className="py-2 text-xs">Unique skill identifier</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								description
							</td>
							<td className="py-2 pr-4 text-xs">Yes</td>
							<td className="py-2 text-xs">
								What the skill teaches -- shown in skill list
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								metadata.roles
							</td>
							<td className="py-2 pr-4 text-xs">Yes</td>
							<td className="py-2 text-xs">
								Which agent roles can use this skill
							</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								metadata.tags
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								Searchable tags for discovery
							</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">
								license
							</td>
							<td className="py-2 pr-4 text-xs">No</td>
							<td className="py-2 text-xs">
								License identifier (MIT, Apache-2.0, etc.)
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── 3-Stage Loading ────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				3-Stage Loading
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Skills are loaded lazily to minimize context window usage:
			</p>
			<ol className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Metadata</strong> -- on startup,
					the loader scans all skill directories and reads only the
					frontmatter. This gives the catalog: name, description,
					roles, tags.
				</li>
				<li>
					<strong className="text-fg">Body</strong> -- when an agent
					requests a skill via{' '}
					<code className="font-mono text-xs text-purple">
						skill_request
					</code>
					, the full markdown body is loaded and injected into
					context.
				</li>
				<li>
					<strong className="text-fg">Resources</strong> -- if the
					skill has a{' '}
					<code className="font-mono text-xs text-purple">
						references/
					</code>{' '}
					directory, those files are listed and available for the
					agent to read on demand.
				</li>
			</ol>
			<CodeBlock title="how-agents-see-skills">
				{`# In agent context (Layer 2 — Company State):

## Available Skills
- **code-review**: Code review standards, checklist, and conventions.
- **testing-strategy**: How to write unit, integration, and E2E tests.
- **git-workflow**: Branch strategy, PR conventions, commit messages.
- **deployment**: Deploy checklist, rollback procedures, health checks.

To use a skill, call: skill_request({ skill_id: "code-review" })

# Agent calls skill_request → full SKILL.md body injected into context
# Agent can then also read references/ files if needed`}
			</CodeBlock>

			{/* ── Skill Templates ────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Skill Templates
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The Solo Dev Shop template ships with 16 customizable skill
				templates covering the full product lifecycle. Each is a
				markdown knowledge doc that agents load on demand:
			</p>
			<div className="overflow-x-auto mb-4">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border">
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Skill
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2 pr-4">
								Roles
							</th>
							<th className="text-left text-ghost font-mono text-xs py-2">
								Description
							</th>
						</tr>
					</thead>
					<tbody className="text-ghost">
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">code-review</td>
							<td className="py-2 pr-4 text-xs">reviewer, developer</td>
							<td className="py-2 text-xs">Code review standards and checklist</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">testing-strategy</td>
							<td className="py-2 pr-4 text-xs">developer, reviewer</td>
							<td className="py-2 text-xs">How to write unit, integration, and E2E tests</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">api-design</td>
							<td className="py-2 pr-4 text-xs">developer, strategist</td>
							<td className="py-2 text-xs">REST/GraphQL API design conventions</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">deployment</td>
							<td className="py-2 pr-4 text-xs">devops</td>
							<td className="py-2 text-xs">Deploy checklist, rollback, health checks</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">document-creation</td>
							<td className="py-2 pr-4 text-xs">all</td>
							<td className="py-2 text-xs">Spec, ADR, and plan templates</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">git-workflow</td>
							<td className="py-2 pr-4 text-xs">developer, reviewer</td>
							<td className="py-2 text-xs">Branch strategy, PR conventions, commit messages</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">incident-response</td>
							<td className="py-2 pr-4 text-xs">devops, meta</td>
							<td className="py-2 text-xs">Incident triage, communication, post-mortem</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">project-scoping</td>
							<td className="py-2 pr-4 text-xs">strategist, planner</td>
							<td className="py-2 text-xs">Feature scoping, estimation, requirements</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">release-notes</td>
							<td className="py-2 pr-4 text-xs">developer, marketing</td>
							<td className="py-2 text-xs">Changelog and release note generation</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">security-checklist</td>
							<td className="py-2 pr-4 text-xs">developer, reviewer</td>
							<td className="py-2 text-xs">OWASP top 10, security best practices</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">ceo-watchdog</td>
							<td className="py-2 pr-4 text-xs">meta</td>
							<td className="py-2 text-xs">Autonomous monitoring, health scans, oversight</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">workflow-design</td>
							<td className="py-2 pr-4 text-xs">meta, strategist</td>
							<td className="py-2 text-xs">How to design and modify workflow definitions</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">task-decomposition</td>
							<td className="py-2 pr-4 text-xs">meta, planner</td>
							<td className="py-2 text-xs">Breaking intents into actionable tasks</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">team-management</td>
							<td className="py-2 pr-4 text-xs">meta</td>
							<td className="py-2 text-xs">Agent roster, role assignment, workload balancing</td>
						</tr>
						<tr className="border-b border-border/50">
							<td className="py-2 pr-4 font-mono text-xs text-purple">process-optimization</td>
							<td className="py-2 pr-4 text-xs">meta, strategist</td>
							<td className="py-2 text-xs">Workflow improvement, bottleneck analysis</td>
						</tr>
						<tr>
							<td className="py-2 pr-4 font-mono text-xs text-purple">dashboard-customization</td>
							<td className="py-2 pr-4 text-xs">design, developer, meta</td>
							<td className="py-2 text-xs">Theme, widgets, layout, and page customization</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* ── Creating Your Own Skill ────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Creating Your Own Skill
			</h2>
			<ol className="text-ghost leading-relaxed space-y-2 mb-4">
				<li>
					<strong className="text-fg">Create the directory</strong> --{' '}
					<code className="font-mono text-xs text-purple">
						mkdir -p skills/my-skill
					</code>
				</li>
				<li>
					<strong className="text-fg">Write SKILL.md</strong> -- add
					frontmatter with name, description, and roles. Write the
					body with actionable knowledge.
				</li>
				<li>
					<strong className="text-fg">(Optional) Add references</strong>{' '}
					-- put supporting docs in{' '}
					<code className="font-mono text-xs text-purple">
						references/
					</code>
				</li>
				<li>
					<strong className="text-fg">(Optional) Add scripts</strong>{' '}
					-- put automation scripts in{' '}
					<code className="font-mono text-xs text-purple">
						scripts/
					</code>
				</li>
				<li>
					<strong className="text-fg">Test it</strong> -- run{' '}
					<code className="font-mono text-xs text-purple">
						autopilot skills
					</code>{' '}
					to verify it appears in the catalog
				</li>
			</ol>
			<CodeBlock title="skills/seo-optimization/SKILL.md">
				{`---
name: seo-optimization
description: |
  SEO best practices for content creation.
  Use when writing blog posts, landing pages, or marketing copy.
license: MIT
metadata:
  author: Your Company
  version: 1.0.0
  tags: [seo, content, marketing]
  roles: [marketing, developer]
---

# SEO Optimization

## When to Use
When creating any public-facing content — blog posts, landing pages, docs.

## Checklist
- Title tag under 60 characters
- Meta description under 160 characters
- H1 contains primary keyword
- Images have alt text
- Internal links to related content
- External links to authoritative sources

## Content Structure
1. Hook (first paragraph)
2. Problem statement
3. Solution with examples
4. Call to action

## Technical SEO
- Semantic HTML (h1 > h2 > h3 hierarchy)
- Schema.org markup for articles
- Canonical URLs on all pages
- sitemap.xml and robots.txt`}
			</CodeBlock>

			{/* ── CLI ────────────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				CLI Commands
			</h2>
			<CodeBlock title="terminal">
				{`# List all available skills
$ autopilot skills
SKILLS — 16 available

  ID                       FORMAT        ROLES
  code-review              agentskills   reviewer, developer
  testing-strategy         agentskills   developer, reviewer
  api-design               agentskills   developer, strategist
  deployment               agentskills   devops
  document-creation        agentskills   all
  ...

# Show a specific skill
$ autopilot skills show code-review
code-review (agentskills)
  Code review standards, checklist, and conventions.
  Roles: reviewer, developer
  Size: 2.4 KB
  Path: skills/code-review/SKILL.md`}
			</CodeBlock>

			{/* ── How Agents Use Skills ──────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				How Agents Use Skills
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				When an agent starts a session, it sees the list of available
				skills (filtered by role) in its context. When it needs domain
				knowledge, it calls{' '}
				<code className="font-mono text-xs text-purple">
					skill_request
				</code>{' '}
				and the full skill content is loaded into context.
			</p>
			<CodeBlock title="agent-skill-usage.ts">
				{`// Agent sees available skills in context:
// - code-review: Code review standards...
// - testing-strategy: How to write tests...

// When reviewing a PR, agent calls:
skill_request({ skill_id: "code-review" })

// → Full SKILL.md body injected into agent context
// → Agent follows the checklist and conventions
// → If references/ exist, agent can read those too`}
			</CodeBlock>

			{/* ── Future ─────────────────────────────────────────── */}

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Marketplace (Future)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Community-created skills will be available via the QUESTPIE
				Marketplace. Install with a single command, or publish your
				own skills for others to use.
			</p>
			<CodeBlock title="terminal">
				{`# Install a community skill
$ autopilot marketplace install @community/skill-seo-expert

# Publish your skill
$ autopilot marketplace publish ./skills/seo-optimization`}
			</CodeBlock>
		</article>
	)
}
