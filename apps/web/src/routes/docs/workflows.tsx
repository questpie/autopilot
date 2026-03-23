import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '@/components/CodeBlock'
import { seoHead } from '@/lib/seo'

export const Route = createFileRoute('/docs/workflows')({
	head: () => ({ ...seoHead({ title: 'Workflows', description: 'YAML workflow definitions for development, marketing, and incident response. How work flows through the company.', path: '/docs/workflows' }) }),
	component: Workflows,
})

function Workflows() {
	return (
		<article className="prose-autopilot">
			<h1 className="font-sans text-3xl font-black text-white mb-2">
				Workflows
			</h1>
			<p className="text-muted text-lg mb-8">
				YAML files that define how work moves through the company. Not
				hardcoded. Not sacred. Living documents owned by the CEO agent.
			</p>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				What Are Workflows?
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Workflows are state machines stored as YAML files in{' '}
				<code className="font-mono text-xs text-purple">
					/company/team/workflows/
				</code>
				. They define the sequence of steps a task goes through — from
				initial intent to completion. Each step specifies which agent
				role handles it, what outputs are expected, timeout behavior, and
				transitions to the next step.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				Workflows are not code. They are data. Agents read them, the
				orchestrator's workflow engine interprets them, and the CEO agent
				is the only one who can modify them. Any agent can propose
				changes, but the CEO evaluates and applies them.
			</p>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Key Principles
			</h3>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Workflows are files</strong> —
					YAML in the filesystem, versioned with git, diffable,
					editable
				</li>
				<li>
					<strong className="text-fg">CEO agent owns them</strong> —
					only the CEO agent can modify workflow files, preventing
					agents from gaming the system
				</li>
				<li>
					<strong className="text-fg">Any agent can propose changes</strong>{' '}
					— if a developer notices a bottleneck, they send a proposal to
					the CEO with evidence
				</li>
				<li>
					<strong className="text-fg">
						Human approves structural changes
					</strong>{' '}
					— adding or removing approval gates, changing permissions.
					Minor optimizations the CEO handles alone
				</li>
				<li>
					<strong className="text-fg">
						Agents don't need to understand the engine
					</strong>{' '}
					— they do their step and call{' '}
					<code className="font-mono text-xs text-purple">
						update_task
					</code>
					. The orchestrator handles routing
				</li>
			</ul>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Workflow YAML Format
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Every workflow file has the same structure: metadata, change
				policy, changelog, and an ordered list of steps. Each step
				defines its assigned role, expected outputs, timeouts, review
				requirements, and transitions.
			</p>
			<CodeBlock title="workflow-schema.yaml">
				{`id: string                          # Unique identifier
name: string                        # Human-readable name
version: number                     # Incremented on every change
description: string                 # What this workflow does

change_policy:
  propose: [any_agent]              # Who can propose changes
  evaluate: [ceo]                   # Who evaluates proposals
  apply: [ceo]                      # Who applies changes
  human_approval_required_for:
    - adding_approval_gate
    - removing_approval_gate
    - changing_agent_permissions
    - adding_step
    - removing_step

changelog:                          # Append-only, managed by CEO
  - version: number
    date: string
    by: string
    change: string
    proposed_by: string             # Optional

steps:
  - id: string                      # Step identifier
    name: string                    # Human-readable name
    assigned_role: string           # Agent role (developer, reviewer, etc.)
    type: string                    # Optional: human_gate, terminal, sub_workflow
    description: string             # What to do in this step

    inputs:                         # What this step consumes
      - from_step: string
        type: string

    outputs:                        # What this step produces
      - type: file | git_branch | git_pr | deployment | report
        path_template: string

    expected_duration: string       # How long this should take
    timeout: string                 # Alert if exceeded
    timeout_action: string          # alert_human, reassign, auto_approve

    review:                         # Optional review requirements
      reviewers_roles: [string]
      min_approvals: number
      on_reject: string             # Step to go back to
      on_reject_max_rounds: number  # Escalate after N rounds

    auto_execute: boolean           # Run immediately without assignment
    can_request_help_from: [string] # Other roles this step can ask

    transitions:                    # Where to go next
      done: string
      approved: string
      rejected: string
      escalated: string`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Development Workflow (12 Steps)
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The standard development lifecycle workflow covers the full path
				from intent to production. It includes scoping, planning,
				implementation, code review, human merge approval, staging
				deploy, verification, production deploy approval, production
				deploy, and rollback handling.
			</p>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Flow Diagram
			</h3>
			<CodeBlock title="development-workflow-flow">
				{`Intent
  │
  ▼
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  Scope  │────▶│   Plan   │────▶│  Implement  │────▶│ Code Review │
│ (strat) │     │ (planner)│     │ (developer) │     │ (reviewer)  │
└─────────┘     └────┬─────┘     └──────┬──────┘     └──────┬──────┘
                     │                  ▲                    │
                     ▼                  │                    │
              ┌─────────────┐     rejected              approved
              │ Human Plan  │─────────┘                     │
              │   Review    │                               ▼
              └─────────────┘                       ┌─────────────┐
                                                    │ Human Merge │
                                                    │  (Dominik)  │
                                                    └──────┬──────┘
                                                           │
                                              approved     │    rejected
                                                 │         │       │
                                                 ▼         │       ▼
                                          ┌──────────┐     │  back to
                                          │  Deploy  │     │  implement
                                          │ Staging  │     │
                                          │  (Ops)   │     │
                                          └────┬─────┘     │
                                               │           │
                                          ┌────▼─────┐     │
                                          │  Verify  │     │
                                          │  (Ops)   │     │
                                          └────┬─────┘     │
                                               │           │
                                          ┌────▼─────────┐ │
                                          │ Human Approve│ │
                                          │  Prod Deploy │ │
                                          └────┬─────────┘ │
                                               │           │
                                          ┌────▼─────┐     │
                                          │  Deploy  │     │
                                          │   Prod   │     │
                                          │  (Ops)   │     │
                                          └────┬─────┘     │
                                          success│  failure│
                                               │      ┌────▼────┐
                                          ┌────▼──┐   │Rollback │
                                          │ Done  │   │ (Ops)   │
                                          └───────┘   └─────────┘`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				Complete Development Workflow
			</h3>
			<CodeBlock title="/company/team/workflows/development.yaml">
				{`id: development
name: "Development Lifecycle"
version: 3
description: |
  Standard flow for shipping features from intent to production.
  Covers scoping, planning, implementation, review, merge, deploy, and verify.

change_policy:
  propose: [any_agent]
  evaluate: [ceo]
  apply: [ceo]
  human_approval_required_for:
    - adding_approval_gate
    - removing_approval_gate
    - changing_agent_permissions
    - adding_step
    - removing_step

changelog:
  - version: 3
    date: "2026-03-22"
    by: ceo
    change: "Added verify step after deploy — Ops noticed we skipped health checks twice"
    proposed_by: ops

  - version: 2
    date: "2026-03-18"
    by: ceo
    change: "Reduced plan review from 3 approvals to 2 — was bottlenecking"
    proposed_by: peter
    human_approved: true

  - version: 1
    date: "2026-03-15"
    by: ceo
    change: "Initial workflow created during company setup"

steps:
  - id: scope
    name: "Scope & Specification"
    assigned_role: strategist
    description: |
      Analyze the intent. Define requirements. Write a spec document.
      The spec should be detailed enough for a planner to create an
      implementation plan without further questions.
    outputs:
      - type: file
        path_template: "/projects/{project}/docs/{task_slug}-spec.md"
    expected_duration: "2h"
    timeout: "8h"
    timeout_action: alert_human
    transitions:
      done: plan

  - id: plan
    name: "Implementation Planning"
    assigned_role: planner
    description: |
      Read the spec. Create a detailed implementation plan with:
      - File-level changes needed
      - Dependencies and order of operations
      - Test strategy
      - Estimated effort
    inputs:
      - from_step: scope
        type: file
    outputs:
      - type: file
        path_template: "/projects/{project}/docs/{task_slug}-plan.md"
    expected_duration: "3h"
    timeout: "12h"
    timeout_action: alert_human
    review:
      reviewers_roles: [developer, reviewer]
      min_approvals: 2
      on_reject: revise
      on_reject_max_rounds: 3
    transitions:
      approved: implement
      rejected: plan
      escalated: human_review_plan

  - id: human_review_plan
    name: "Human Reviews Plan"
    type: human_gate
    assigned_to: human
    gate: review
    description: |
      Plan review went through 3 rounds without consensus.
      Human reviews and either approves, rejects with guidance,
      or restructures the task.
    transitions:
      approved: implement
      rejected_with_feedback: plan
      cancelled: cancelled

  - id: implement
    name: "Implementation"
    assigned_role: developer
    description: |
      Implement according to the plan. Create a feature branch,
      write code, commit incrementally, create PR when done.
    inputs:
      - from_step: scope
        type: file
      - from_step: plan
        type: file
    outputs:
      - type: git_branch
        name_template: "feat/{task_slug}"
      - type: git_pr
        target: main
    expected_duration: "1-3d"
    timeout: "5d"
    timeout_action: alert_human
    can_request_help_from: [planner, strategist, devops]
    transitions:
      done: code_review

  - id: code_review
    name: "Code Review"
    assigned_role: reviewer
    description: |
      Review the PR for:
      - Correctness (does it match the spec?)
      - Code quality (patterns, types, error handling)
      - Test coverage
      - Performance concerns
    inputs:
      - from_step: implement
        type: git_pr
    review:
      min_approvals: 1
      on_reject: implement
      on_reject_max_rounds: 5
    expected_duration: "4h"
    timeout: "1d"
    timeout_action: reassign
    transitions:
      approved: human_merge
      rejected: implement

  - id: human_merge
    name: "Human Merge"
    type: human_gate
    assigned_to: human
    gate: merge
    description: |
      PR is reviewed and approved by agents. Human does final check
      and merges to main.
    surface:
      show_pr: true
      show_review_comments: true
      show_spec: true
    transitions:
      approved: deploy
      rejected: implement

  - id: deploy
    name: "Deploy to Staging"
    assigned_role: devops
    description: |
      Deploy the merged code to staging environment.
      Run integration tests. Check for regressions.
    auto_execute: true
    outputs:
      - type: deployment
        environment: staging
    transitions:
      success: verify
      failure: implement

  - id: verify
    name: "Verify & Promote"
    assigned_role: devops
    description: |
      Run health checks on staging. Smoke test critical paths.
      If everything passes, request human approval for production.
    outputs:
      - type: report
        path_template: "/projects/{project}/docs/{task_slug}-deploy-report.md"
    transitions:
      staging_ok: human_deploy_prod
      staging_fail: implement

  - id: human_deploy_prod
    name: "Approve Production Deploy"
    type: human_gate
    assigned_to: human
    gate: deploy
    description: |
      Staging looks good. Human approves promotion to production.
    surface:
      show_deploy_report: true
      show_staging_url: true
    transitions:
      approved: deploy_prod
      rejected: implement

  - id: deploy_prod
    name: "Deploy to Production"
    assigned_role: devops
    description: "Promote staging to production. Monitor for 30 minutes."
    outputs:
      - type: deployment
        environment: production
    transitions:
      success: complete
      failure: rollback

  - id: rollback
    name: "Rollback"
    assigned_role: devops
    description: "Production deploy failed. Roll back to previous version."
    auto_execute: true
    transitions:
      done: implement

  - id: complete
    name: "Done"
    type: terminal
    actions:
      - move_task_to: done
      - notify: ["{created_by}", "human:dominik"]
      - pin_to_board:
          group: progress
          title: "✓ {task_title} shipped"
          type: success
          expires_at: "+24h"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Marketing Workflow
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The marketing campaign workflow handles the path from feature or
				product to public announcement. It covers briefing, content
				creation, design assets, human approval, publishing, and
				engagement monitoring.
			</p>
			<CodeBlock title="/company/team/workflows/marketing.yaml">
				{`id: marketing
name: "Marketing Campaign"
version: 1
description: |
  From feature/product to public announcement.
  Covers briefing, content creation, human approval, and publishing.

change_policy:
  propose: [any_agent]
  evaluate: [ceo]
  apply: [ceo]
  human_approval_required_for:
    - adding_approval_gate
    - removing_approval_gate

steps:
  - id: brief
    name: "Campaign Brief"
    assigned_role: strategist
    description: |
      Define campaign objectives, target audience, key messages,
      channels, and timeline. Reference brand guidelines.
    outputs:
      - type: file
        path_template: "/projects/{project}/marketing/{task_slug}-brief.md"
    expected_duration: "2h"
    transitions:
      done: create_content

  - id: create_content
    name: "Content Creation"
    assigned_role: marketing
    description: |
      Based on the brief, create all content:
      - Social media posts (Twitter threads, LinkedIn)
      - Blog post draft
      - Visual asset descriptions (for image generation)
      - Email copy (if applicable)
    inputs:
      - from_step: brief
        type: file
    outputs:
      - type: file
        path_template: "/projects/{project}/marketing/{task_slug}-content.md"
    expected_duration: "4h"
    transitions:
      done: design_assets

  - id: design_assets
    name: "Design Visual Assets"
    assigned_role: design
    description: |
      Create visual assets for the campaign. Use image generation
      for quick drafts, design tools for final versions.
    can_skip_if: "no_visual_assets_needed"
    transitions:
      done: human_review
      skipped: human_review

  - id: human_review
    name: "Human Approves Content"
    type: human_gate
    assigned_to: human
    gate: publish
    description: |
      All content and assets ready. Human reviews everything
      before anything goes public.
    surface:
      show_content: true
      show_assets: true
      show_brief: true
    transitions:
      approved: publish
      rejected: create_content

  - id: publish
    name: "Publish & Schedule"
    assigned_role: marketing
    description: |
      Publish approved content to channels. Schedule future posts.
      Track initial engagement.
    auto_execute: true
    transitions:
      done: monitor

  - id: monitor
    name: "Monitor Engagement"
    assigned_role: marketing
    description: |
      Monitor for 48 hours. Report on engagement metrics.
      Pin summary to dashboard.
    expected_duration: "48h"
    transitions:
      done: complete

  - id: complete
    type: terminal
    actions:
      - move_task_to: done
      - pin_to_board:
          group: marketing
          title: "Campaign complete: {task_title}"
          type: success
          expires_at: "+7d"`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Incident Response Workflow
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The incident response workflow prioritizes speed over process.
				Fewer gates, shorter timeouts, and direct-to-production deploys
				for hotfixes. It branches based on the triage outcome: infra
				issue, code issue, or external issue.
			</p>
			<CodeBlock title="/company/team/workflows/incident.yaml">
				{`id: incident
name: "Incident Response"
version: 1
description: |
  Rapid response workflow for production issues.
  Prioritizes speed over process. Fewer gates.

steps:
  - id: triage
    name: "Triage"
    assigned_role: devops
    description: |
      Assess severity. Gather logs. Identify root cause.
      Pin status update to dashboard immediately.
    expected_duration: "15m"
    timeout: "30m"
    timeout_action: alert_human
    outputs:
      - type: file
        path_template: "/projects/{project}/docs/incidents/{date}-triage.md"
      - type: board_pin
        group: alerts
        priority: urgent
    transitions:
      infra_issue: fix_infra
      code_issue: hotfix
      external_issue: monitor_external
      unknown: escalate_human

  - id: fix_infra
    name: "Fix Infrastructure"
    assigned_role: devops
    auto_execute: true
    expected_duration: "30m"
    timeout: "1h"
    timeout_action: alert_human
    transitions:
      fixed: verify_fix
      cannot_fix: escalate_human

  - id: hotfix
    name: "Hotfix"
    assigned_role: developer
    description: |
      Code-level issue. Create hotfix branch. Fix. Push.
      Skip planning step — this is urgent.
    outputs:
      - type: git_branch
        name_template: "hotfix/{task_slug}"
      - type: git_pr
        target: main
        labels: ["hotfix", "urgent"]
    expected_duration: "1h"
    timeout: "3h"
    timeout_action: alert_human
    transitions:
      done: quick_review

  - id: quick_review
    name: "Quick Code Review"
    assigned_role: reviewer
    description: |
      Fast review. Focus on correctness, not style.
      Must complete within 30 minutes.
    review:
      min_approvals: 1
      on_reject: hotfix
    expected_duration: "30m"
    timeout: "1h"
    timeout_action: auto_approve
    transitions:
      approved: human_merge_hotfix
      rejected: hotfix

  - id: human_merge_hotfix
    name: "Merge Hotfix"
    type: human_gate
    assigned_to: human
    gate: merge
    timeout: "30m"
    timeout_action: alert_human_urgent
    transitions:
      approved: deploy_hotfix
      rejected: hotfix

  - id: deploy_hotfix
    name: "Deploy Hotfix"
    assigned_role: devops
    description: "Deploy directly to production. Skip staging for hotfixes."
    auto_execute: true
    transitions:
      success: verify_fix
      failure: rollback_hotfix

  - id: rollback_hotfix
    name: "Rollback Hotfix"
    assigned_role: devops
    auto_execute: true
    transitions:
      done: escalate_human

  - id: monitor_external
    name: "Monitor External Issue"
    assigned_role: devops
    expected_duration: "4h"
    transitions:
      resolved: verify_fix
      not_resolved: escalate_human

  - id: escalate_human
    name: "Escalate to Human"
    type: human_gate
    assigned_to: human
    gate: incident
    description: "Agents couldn't resolve. Human takes over."
    surface:
      show_triage: true
      show_logs: true
    transitions:
      resolved: verify_fix
      need_external_help: complete

  - id: verify_fix
    name: "Verify Fix"
    assigned_role: devops
    description: |
      Confirm the fix resolved the issue. Monitor for 30 minutes.
      Write postmortem.
    outputs:
      - type: file
        path_template: "/projects/{project}/docs/incidents/{date}-postmortem.md"
    expected_duration: "1h"
    transitions:
      verified: complete
      regression: triage

  - id: complete
    type: terminal
    actions:
      - move_task_to: done
      - pin_to_board:
          group: alerts
          title: "Incident resolved: {task_title}"
          type: success
          expires_at: "+24h"
      - notify: [human:dominik]`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Workflow Engine
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The orchestrator runs a simple state machine (~300 LOC) that
				reads workflow YAML, matches task states, and routes
				accordingly. Each task has a{' '}
				<code className="font-mono text-xs text-purple">workflow</code>{' '}
				and{' '}
				<code className="font-mono text-xs text-purple">
					workflow_step
				</code>{' '}
				field. The engine watches for task status changes, looks up the
				current step, checks transition conditions, and moves to the
				next step.
			</p>
			<CodeBlock title="workflow-engine.ts">
				{`async function onTaskChanged(task: Task): Promise<void> {
  if (!task.workflow || !task.workflow_step) return

  const workflow = await loadWorkflow(task.workflow)
  const currentStep = workflow.steps.find(s => s.id === task.workflow_step)
  if (!currentStep) return

  // Check timeouts
  if (currentStep.timeout) {
    const elapsed = Date.now() - new Date(task.updated_at).getTime()
    const timeoutMs = parseDuration(currentStep.timeout)
    if (elapsed > timeoutMs) {
      await handleTimeout(task, currentStep)
      return
    }
  }

  // Terminal step — task is done
  if (currentStep.type === "terminal") {
    await executeTerminalActions(task, currentStep)
    return
  }

  // Human gate — waiting for human action
  if (currentStep.type === "human_gate") {
    if (task.status === "review") return
    await routeToHuman(task, currentStep)
    return
  }

  // Review step — check approvals
  if (currentStep.review) {
    const approvals = await countApprovals(task)
    if (approvals >= currentStep.review.min_approvals) {
      await transition(task, workflow, currentStep.transitions.approved)
      return
    }
    const rejections = await countRejections(task)
    if (rejections > 0) {
      const rounds = await countReviewRounds(task)
      if (currentStep.review.on_reject_max_rounds &&
          rounds >= currentStep.review.on_reject_max_rounds) {
        await transition(task, workflow,
          currentStep.transitions.escalated || currentStep.transitions.rejected)
        return
      }
      await transition(task, workflow, currentStep.transitions.rejected)
      return
    }
    return // Waiting for reviewers
  }

  // Normal step — route based on status
  if (task.status === "done" || task.status === "review") {
    const nextStepId = currentStep.transitions.done ||
                       currentStep.transitions.success
    if (nextStepId) {
      await transition(task, workflow, nextStepId)
    }
  }
}`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Conditional Transitions
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Transitions can be conditional based on task priority or flags.
				The workflow engine resolves them at runtime.
			</p>
			<CodeBlock title="conditional-transitions.yaml">
				{`# Different paths based on task priority
transitions:
  done:
    if_priority_critical: quick_review    # Skip full review for hotfixes
    if_priority_high: code_review
    default: code_review

# Skip steps based on flags
transitions:
  done:
    if_flag_no_frontend: deploy           # Skip design step
    default: design_review`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				How Workflow Changes Happen
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Any agent can propose a workflow change by sending a structured
				message to the CEO agent. The proposal includes the target
				workflow, the proposed change, reasoning with evidence, and
				impact assessment.
			</p>
			<CodeBlock title="workflow-change-proposal.ts">
				{`// A developer proposes reducing plan review approvals
send_message({
  to: "agent:ceo",
  content: \`WORKFLOW_CHANGE_PROPOSAL

workflow: development
step: plan
proposed_change: Reduce min_approvals from 2 to 1 for plan review
reason: |
  In the last 5 tasks, plan review averaged 6 hours because we need
  2 agents to review. Most plans are straightforward. Suggest requiring
  only 1 approval for medium/low priority tasks, keeping 2 for high/critical.

  Evidence:
  - task-035: plan approved by both reviewers with zero changes (wasted 3h)
  - task-038: plan had 1 minor comment, both approved same version
  - task-040: plan was rejected once, then approved — 2nd reviewer added no value

impact: Faster iteration. Risk: slightly lower plan quality for edge cases.\`,
  references: ["task-035", "task-038", "task-040"]
})`}
			</CodeBlock>

			<h3 className="font-sans text-lg font-bold text-white mt-8 mb-3">
				CEO Evaluation
			</h3>
			<p className="text-ghost leading-relaxed mb-4">
				The CEO agent evaluates every proposal along four dimensions:
			</p>
			<ol className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Is it structural?</strong> —
					Adding/removing gates, steps, or permissions requires human
					approval. CEO prepares a recommendation and pins it to the
					dashboard.
				</li>
				<li>
					<strong className="text-fg">Is it an optimization?</strong>{' '}
					— Timeout values, expected durations, descriptions. CEO can
					apply these directly and log the change.
				</li>
				<li>
					<strong className="text-fg">Is it evidence-based?</strong>{' '}
					— CEO checks referenced tasks and sessions to verify the
					claim.
				</li>
				<li>
					<strong className="text-fg">What is the risk?</strong> —
					Impact on quality, speed, and safety.
				</li>
			</ol>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Human Gates & Approval Flow
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Human gates are workflow steps where execution pauses until a
				human takes action. They are the safety boundary between
				autonomous agent work and irreversible effects.
			</p>
			<p className="text-ghost leading-relaxed mb-4">
				Three types of actions require human gates in the default
				workflows:
			</p>
			<ul className="text-ghost leading-relaxed space-y-2 mb-6">
				<li>
					<strong className="text-fg">Merge</strong> — merging code
					to the main branch after agent review
				</li>
				<li>
					<strong className="text-fg">Deploy</strong> — promoting
					from staging to production
				</li>
				<li>
					<strong className="text-fg">Publish</strong> — releasing
					marketing content publicly
				</li>
			</ul>
			<p className="text-ghost leading-relaxed mb-4">
				Human gates include a{' '}
				<code className="font-mono text-xs text-purple">surface</code>{' '}
				field that tells the dashboard what to show the human — the PR,
				review comments, deploy report, or content preview. The human
				approves, rejects with feedback, or cancels the task entirely.
			</p>
			<CodeBlock title="human-gate-step.yaml">
				{`- id: human_merge
  name: "Human Merge"
  type: human_gate
  assigned_to: human
  gate: merge
  description: |
    PR is reviewed and approved by agents. Human does final check
    and merges to main.
  surface:
    show_pr: true
    show_review_comments: true
    show_spec: true
  transitions:
    approved: deploy
    rejected: implement    # Back to developer with feedback`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Workflow Composition
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				Workflows can reference other workflows for sub-tasks using the{' '}
				<code className="font-mono text-xs text-purple">
					sub_workflow
				</code>{' '}
				step type. This allows composing larger processes from smaller,
				reusable workflows.
			</p>
			<CodeBlock title="workflow-composition.yaml">
				{`# A marketing launch workflow that includes development
steps:
  - id: build_feature
    name: "Build the Feature"
    type: sub_workflow
    workflow: development            # Run the full dev workflow
    description: "Build the feature using standard dev lifecycle"
    transitions:
      completed: create_campaign

  - id: create_campaign
    name: "Create Launch Campaign"
    type: sub_workflow
    workflow: marketing
    transitions:
      completed: complete`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Workflow Metrics
			</h2>
			<p className="text-ghost leading-relaxed mb-4">
				The orchestrator tracks workflow performance automatically. Metrics
				are generated monthly and stored in the filesystem. The CEO agent
				reads them during scheduled workflow reviews and proposes data-driven
				optimizations.
			</p>
			<CodeBlock title="/company/logs/workflow-metrics/development-2026-03.yaml">
				{`workflow: development
period: "2026-03"

tasks_completed: 12
tasks_in_progress: 3
tasks_cancelled: 1

step_metrics:
  scope:
    avg_duration: "1.8h"
    max_duration: "4.2h"
    timeout_count: 0
  plan:
    avg_duration: "2.5h"
    max_duration: "8h"
    avg_review_rounds: 1.3
    rejection_rate: 0.25
  implement:
    avg_duration: "12h"
    max_duration: "3d"
    help_requests: 2
  code_review:
    avg_duration: "2h"
    avg_review_rounds: 1.5
    rejection_rate: 0.33
  human_merge:
    avg_duration: "45m"
  deploy:
    avg_duration: "8m"
    failure_rate: 0.08
    rollback_count: 1

bottlenecks:
  - step: plan
    issue: "Review takes too long when both reviewers are busy"
    suggestion: "Consider reducing to 1 approval for low-priority"
  - step: human_merge
    issue: "Average 45m wait for human merge during business hours"
    suggestion: "Consider auto-merge for PRs with 2+ agent approvals and passing CI"

efficiency_score: 0.78`}
			</CodeBlock>

			<h2 className="font-sans text-xl font-bold text-white mt-10 mb-4">
				Standard Workflow Summary
			</h2>
			<CodeBlock title="workflows-overview">
				{`STORAGE     /company/team/workflows/*.yaml
OWNER       CEO agent (exclusive write access)
PROPOSERS   Any agent can propose changes
APPROVAL    CEO for optimizations, human for structural changes
TRACKING    Changelog in YAML + git history
METRICS     Auto-generated monthly by orchestrator
ENGINE      Simple state machine in orchestrator (~300 LOC)

STANDARD WORKFLOWS
──────────────────
development.yaml    Intent → Scope → Plan → Implement → Review → Merge → Deploy
marketing.yaml      Brief → Content → Design → Human Review → Publish → Monitor
incident.yaml       Triage → Fix/Hotfix → Quick Review → Deploy → Verify
onboarding.yaml     Define → Tools → Knowledge → Design → Ready
knowledge.yaml      Propose → CEO Review → Apply → Reindex

CHANGE PROTOCOL
───────────────
1. Agent notices inefficiency or problem
2. Agent sends WORKFLOW_CHANGE_PROPOSAL to CEO
3. CEO evaluates evidence, risk, impact
4. Minor change → CEO applies directly
   Structural change → CEO pins to dashboard for human approval
5. Change logged in changelog + git
6. Affected agents see updated workflow in next session`}
			</CodeBlock>
		</article>
	)
}
