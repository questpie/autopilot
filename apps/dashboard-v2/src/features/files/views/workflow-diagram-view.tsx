import { useMemo } from "react"
import {
  ArrowRightIcon,
  CircleIcon,
  CheckCircleIcon,
  PauseIcon,
  PlayIcon,
  EyeIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FileViewProps } from "@/lib/view-registry"

interface WorkflowStep {
  id: string
  name: string
  type: string
  agent?: string
  transitions?: Array<{ target: string; condition?: string }>
}

interface ParsedWorkflow {
  name: string
  description: string
  steps: WorkflowStep[]
}

/**
 * Very basic YAML parser for workflow files.
 * Extracts name, description, and steps with transitions.
 */
function parseWorkflowYaml(content: string): ParsedWorkflow {
  const workflow: ParsedWorkflow = {
    name: "",
    description: "",
    steps: [],
  }

  const lines = content.split("\n")
  let currentStep: WorkflowStep | null = null
  let inSteps = false
  let inTransitions = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("name:")) {
      if (!inSteps) workflow.name = trimmed.slice(5).trim()
      else if (currentStep) currentStep.name = trimmed.slice(5).trim()
    } else if (trimmed.startsWith("description:") && !inSteps) {
      workflow.description = trimmed.slice(12).trim()
    } else if (trimmed === "steps:") {
      inSteps = true
    } else if (inSteps && trimmed.startsWith("- id:")) {
      if (currentStep) workflow.steps.push(currentStep)
      currentStep = {
        id: trimmed.slice(5).trim(),
        name: "",
        type: "action",
        transitions: [],
      }
      inTransitions = false
    } else if (currentStep && trimmed.startsWith("type:")) {
      currentStep.type = trimmed.slice(5).trim()
    } else if (currentStep && trimmed.startsWith("agent:")) {
      currentStep.agent = trimmed.slice(6).trim()
    } else if (currentStep && trimmed === "transitions:") {
      inTransitions = true
    } else if (inTransitions && trimmed.startsWith("- target:")) {
      currentStep?.transitions?.push({ target: trimmed.slice(9).trim() })
    } else if (inTransitions && trimmed.startsWith("condition:") && currentStep?.transitions?.length) {
      const lastTransition = currentStep.transitions[currentStep.transitions.length - 1]
      lastTransition.condition = trimmed.slice(10).trim()
    }
  }
  if (currentStep) workflow.steps.push(currentStep)

  return workflow
}

function getStepIcon(type: string) {
  switch (type) {
    case "end":
      return CheckCircleIcon
    case "gate":
    case "review":
      return PauseIcon
    case "start":
      return PlayIcon
    case "observe":
      return EyeIcon
    default:
      return CircleIcon
  }
}

function getStepColor(type: string): string {
  switch (type) {
    case "end":
      return "border-green-500/30 bg-green-500/5"
    case "gate":
    case "review":
      return "border-yellow-500/30 bg-yellow-500/5"
    case "start":
      return "border-blue-500/30 bg-blue-500/5"
    default:
      return "border-border bg-card"
  }
}

/**
 * Workflow diagram view — visual state machine from YAML.
 * Shows steps as cards with transition arrows.
 */
function WorkflowDiagramView({ content }: FileViewProps) {
  const { t } = useTranslation()
  const workflow = useMemo(() => parseWorkflowYaml(content), [content])

  if (workflow.steps.length === 0) {
    return (
      <div className="p-6">
        <p className="text-xs text-muted-foreground">{t("files.no_workflow_steps")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-bold text-foreground">
          {workflow.name || t("files.untitled_workflow")}
        </h2>
        {workflow.description && (
          <p className="text-xs text-muted-foreground">{workflow.description}</p>
        )}
      </div>

      {/* Visual diagram */}
      <div className="flex flex-wrap items-start gap-3">
        {workflow.steps.map((step, i) => {
          const StepIcon = getStepIcon(step.type)
          const isLast = i === workflow.steps.length - 1

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex min-w-[140px] flex-col gap-2 border p-3",
                  getStepColor(step.type),
                )}
              >
                <div className="flex items-center gap-2">
                  <StepIcon size={14} className="shrink-0" />
                  <span className="font-heading text-xs font-medium text-foreground">
                    {step.name || step.id}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="rounded-none text-[9px]">
                    {step.type}
                  </Badge>
                  {step.agent && (
                    <Badge variant="secondary" className="rounded-none text-[9px]">
                      {step.agent}
                    </Badge>
                  )}
                </div>
                {step.transitions && step.transitions.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {step.transitions.map((tr, j) => (
                      <span key={j} className="text-[9px] text-muted-foreground">
                        {tr.condition ? `${tr.condition} -> ${tr.target}` : `-> ${tr.target}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!isLast && (
                <ArrowRightIcon size={16} className="shrink-0 text-muted-foreground" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkflowDiagramView
