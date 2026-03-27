import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "@/lib/i18n"
import { useCreateTask } from "./task.mutations"

const TASK_TYPES = [
  "intent",
  "planning",
  "implementation",
  "review",
  "deployment",
  "marketing",
  "monitoring",
  "human_required",
] as const

const PRIORITIES = ["critical", "high", "medium", "low"] as const

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(TASK_TYPES).default("implementation"),
  priority: z.enum(PRIORITIES).default("medium"),
  assigned_to: z.string().optional(),
  project: z.string().optional(),
  workflow: z.string().optional(),
})

type CreateTaskFormValues = z.infer<typeof createTaskSchema>

interface TaskCreateFormProps {
  onClose: () => void
}

export function TaskCreateForm({ onClose }: TaskCreateFormProps) {
  const { t } = useTranslation()
  const createTask = useCreateTask()

  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "implementation",
      priority: "medium",
      assigned_to: "",
      project: "",
      workflow: "",
    },
  })

  function onSubmit(values: CreateTaskFormValues) {
    createTask.mutate(
      {
        title: values.title,
        description: values.description,
        type: values.type,
        priority: values.priority,
        assigned_to: values.assigned_to || undefined,
        project: values.project || undefined,
        workflow: values.workflow || undefined,
      },
      {
        onSuccess: () => {
          form.reset()
          onClose()
        },
      },
    )
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4 p-4"
    >
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="font-heading text-xs">
          {t("tasks.create_title_label")}
        </Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder={t("tasks.create_title_placeholder")}
          className="font-heading text-sm"
          autoFocus
        />
        {form.formState.errors.title && (
          <p className="text-[11px] text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="font-heading text-xs">
          {t("tasks.create_description_label")}
        </Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder={t("tasks.create_description_placeholder")}
          className="min-h-[80px] font-heading text-xs"
        />
      </div>

      {/* Type + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="font-heading text-xs">
            {t("tasks.create_type_label")}
          </Label>
          <Select
            value={form.watch("type")}
            onValueChange={(v) =>
              form.setValue("type", v as CreateTaskFormValues["type"])
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="font-heading text-xs">
            {t("tasks.create_priority_label")}
          </Label>
          <Select
            value={form.watch("priority")}
            onValueChange={(v) =>
              form.setValue("priority", v as CreateTaskFormValues["priority"])
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {t(`tasks.priority_${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignee + Project */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assigned_to" className="font-heading text-xs">
            {t("tasks.create_assignee_label")}
          </Label>
          <Input
            id="assigned_to"
            {...form.register("assigned_to")}
            placeholder={t("tasks.unassigned")}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project" className="font-heading text-xs">
            {t("tasks.create_project_label")}
          </Label>
          <Input
            id="project"
            {...form.register("project")}
            placeholder={t("tasks.create_project_placeholder")}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Workflow */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workflow" className="font-heading text-xs">
          {t("tasks.create_workflow_label")}
        </Label>
        <Input
          id="workflow"
          {...form.register("workflow")}
          placeholder={t("common.optional")}
          className="h-8 text-xs"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={createTask.isPending}
        >
          {t("tasks.create_submit")}
        </Button>
      </div>
    </form>
  )
}
