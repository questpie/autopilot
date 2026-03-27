import { CheckCircleIcon, CircleIcon, CircleNotchIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface HistoryEntry {
  at: string
  by: string
  action: string
  step?: string
  from_step?: string
  to_step?: string
}

interface WorkflowProgressProps {
  workflowStep?: string
  history: HistoryEntry[]
  status: string
}

interface WorkflowStep {
  name: string
  agent: string
  state: "done" | "active" | "waiting"
}

/**
 * Extracts workflow steps from task history.
 * Steps that have been completed show as done, the current step as active, rest as waiting.
 */
function extractSteps(
  history: HistoryEntry[],
  currentStep: string | undefined,
  status: string,
): WorkflowStep[] {
  const stepsMap = new Map<string, { agent: string; completed: boolean }>()
  const stepOrder: string[] = []

  for (const entry of history) {
    const step = entry.to_step ?? entry.step
    if (step && !stepsMap.has(step)) {
      stepOrder.push(step)
      stepsMap.set(step, { agent: entry.by, completed: false })
    }

    if (entry.from_step && stepsMap.has(entry.from_step)) {
      const s = stepsMap.get(entry.from_step)
      if (s) s.completed = true
    }
  }

  // If current step is known but not in the map, add it
  if (currentStep && !stepsMap.has(currentStep)) {
    stepOrder.push(currentStep)
    stepsMap.set(currentStep, { agent: "---", completed: false })
  }

  if (stepOrder.length === 0 && currentStep) {
    return [
      {
        name: currentStep,
        agent: "---",
        state: status === "done" ? "done" : "active",
      },
    ]
  }

  const isDone = status === "done"

  return stepOrder.map((name) => {
    const data = stepsMap.get(name)
    const isCurrentStep = name === currentStep

    let state: "done" | "active" | "waiting"
    if (isDone || data?.completed) {
      state = "done"
    } else if (isCurrentStep) {
      state = "active"
    } else {
      state = "waiting"
    }

    return { name, agent: data?.agent ?? "---", state }
  })
}

export function WorkflowProgress({
  workflowStep,
  history,
  status,
}: WorkflowProgressProps) {
  const { t } = useTranslation()
  const steps = extractSteps(history, workflowStep, status)

  if (steps.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="mb-2 font-heading text-xs font-medium text-muted-foreground uppercase">
        {t("tasks.detail_workflow_progress")}
      </h3>
      <div className="flex flex-col">
        {steps.map((step, idx) => (
          <div
            key={`${step.name}-${idx}`}
            className="flex items-center gap-3 py-1.5"
          >
            {/* Step icon */}
            {step.state === "done" && (
              <CheckCircleIcon
                size={16}
                weight="fill"
                className="shrink-0 text-green-500"
              />
            )}
            {step.state === "active" && (
              <CircleNotchIcon
                size={16}
                weight="bold"
                className="shrink-0 animate-spin text-primary"
              />
            )}
            {step.state === "waiting" && (
              <CircleIcon
                size={16}
                className="shrink-0 text-muted-foreground/50"
              />
            )}

            {/* Connector line */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "font-heading text-xs",
                  step.state === "done" && "text-muted-foreground",
                  step.state === "active" && "text-foreground font-medium",
                  step.state === "waiting" && "text-muted-foreground/60",
                )}
              >
                {step.name}
              </span>
              <span className="text-[11px] text-muted-foreground/60">
                {step.agent}
              </span>
            </div>

            {/* State label */}
            <span
              className={cn(
                "shrink-0 font-heading text-[10px]",
                step.state === "done" && "text-green-500",
                step.state === "active" && "text-primary",
                step.state === "waiting" && "text-muted-foreground/40",
              )}
            >
              {step.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
