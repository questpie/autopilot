import { useState, useMemo, Suspense, type ReactNode } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSuspenseQuery, useQuery } from "@tanstack/react-query"
import {
  TagIcon,
  UserIcon,
  FolderIcon,
  TreeStructureIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { useTranslation } from "@/lib/i18n"
import { useCreateTask } from "./task.mutations"
import { agentsQuery } from "@/features/team/team.queries"
import { tasksQuery } from "./task.queries"
import { directoryQuery } from "@/features/files/files.queries"
import { queryKeys } from "@/lib/query-keys"

const PRIORITIES = ["critical", "high", "medium", "low"] as const

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  assigned_to: z.string().optional(),
  project: z.string().optional(),
  workflow: z.string().optional(),
  labels: z.array(z.string()).default([]),
})

type CreateTaskFormValues = z.infer<typeof createTaskSchema>

function labelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 65%, 45%)`
}

const TRIGGER_CLASS =
  "flex h-8 w-full items-center gap-1.5 border border-input bg-transparent px-2.5 py-2 text-xs transition-colors hover:bg-input/30 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"

function SearchableSelect({
  value,
  placeholder,
  emptyText,
  icon,
  onSelect,
  children,
}: {
  value: string
  placeholder: string
  emptyText: string
  icon: ReactNode
  onSelect: (val: string) => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={TRIGGER_CLASS}>
        {icon}
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>{children(close)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function AssigneeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const { t } = useTranslation()
  const { data: agents } = useSuspenseQuery(agentsQuery)

  const agentList = useMemo(() => {
    if (!Array.isArray(agents)) return []
    return agents.map((a: Record<string, unknown>) => ({
      id: String(a.id ?? a.name ?? ""),
      name: String(a.name ?? a.id ?? ""),
    }))
  }, [agents])

  const selectedLabel = agentList.find((a) => a.id === value)?.name ?? ""

  return (
    <SearchableSelect
      value={selectedLabel}
      placeholder={t("tasks.create_assignee_placeholder")}
      emptyText={t("tasks.no_agents_found")}
      icon={<UserIcon className="size-3.5 shrink-0 text-muted-foreground" />}
      onSelect={onChange}
    >
      {(close) =>
        agentList.map((agent) => (
          <CommandItem
            key={agent.id}
            value={agent.name}
            data-checked={value === agent.id || undefined}
            onSelect={() => {
              onChange(value === agent.id ? "" : agent.id)
              close()
            }}
          >
            <UserIcon className="size-3.5 text-muted-foreground" />
            {agent.name}
          </CommandItem>
        ))
      }
    </SearchableSelect>
  )
}

function ProjectSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const { t } = useTranslation()
  const { data: tasks } = useSuspenseQuery(tasksQuery())

  const projects = useMemo(() => {
    if (!Array.isArray(tasks)) return []
    const set = new Set<string>()
    for (const task of tasks) {
      const p = (task as Record<string, unknown>).project
      if (typeof p === "string" && p.length > 0) set.add(p)
    }
    return Array.from(set).sort()
  }, [tasks])

  return (
    <SearchableSelectWithCreate
      value={value}
      placeholder={t("tasks.create_project_placeholder")}
      emptyText={t("tasks.no_projects_found")}
      icon={<FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />}
      options={projects}
      onChange={onChange}
      createLabel={(name) => t("tasks.create_new_project", { name })}
    />
  )
}

function SearchableSelectWithCreate({
  value,
  placeholder,
  emptyText,
  icon,
  options,
  onChange,
  createLabel,
}: {
  value: string
  placeholder: string
  emptyText: string
  icon: ReactNode
  options: string[]
  onChange: (val: string) => void
  createLabel: (name: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const showCreateOption =
    search.length > 0 && !options.some((p) => p.toLowerCase() === search.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={TRIGGER_CLASS}>
        {icon}
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  data-checked={value === option || undefined}
                  onSelect={() => {
                    onChange(value === option ? "" : option)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  {icon}
                  {option}
                </CommandItem>
              ))}
              {showCreateOption && (
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onChange(search)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  {icon}
                  {createLabel(search)}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function WorkflowSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const { t } = useTranslation()
  const { data: workflowFiles } = useQuery({
    ...directoryQuery("workflows"),
    queryKey: [...queryKeys.workflows.list(), "directory"],
  })

  const workflows = useMemo(() => {
    if (!Array.isArray(workflowFiles)) return []
    return workflowFiles
      .filter((f) => f.type === "file" && f.name.endsWith(".yaml"))
      .map((f) => f.name.replace(".yaml", ""))
      .sort()
  }, [workflowFiles])

  return (
    <SearchableSelect
      value={value}
      placeholder={t("tasks.create_workflow_placeholder")}
      emptyText={t("tasks.no_workflows_found")}
      icon={<TreeStructureIcon className="size-3.5 shrink-0 text-muted-foreground" />}
      onSelect={onChange}
    >
      {(close) =>
        workflows.map((wf) => (
          <CommandItem
            key={wf}
            value={wf}
            data-checked={value === wf || undefined}
            onSelect={() => {
              onChange(value === wf ? "" : wf)
              close()
            }}
          >
            <TreeStructureIcon className="size-3.5 text-muted-foreground" />
            {wf}
          </CommandItem>
        ))
      }
    </SearchableSelect>
  )
}

function LabelsInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (val: string[]) => void
}) {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState("")

  function addLabel(label: string) {
    const trimmed = label.trim()
    if (trimmed.length === 0) return
    if (value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInputValue("")
  }

  function removeLabel(label: string) {
    onChange(value.filter((l) => l !== label))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {value.map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="gap-1 pr-1"
              style={{ borderColor: labelColor(label), color: labelColor(label) }}
            >
              {label}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeLabel(label)}
              >
                <XIcon className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t("tasks.create_labels_placeholder")}
          className="h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addLabel(inputValue)
            }
            if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
              removeLabel(value[value.length - 1])
            }
          }}
        />
      </div>
    </div>
  )
}

function SelectSkeleton() {
  return <Skeleton className="h-8 w-full" />
}

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
      priority: "medium",
      assigned_to: "",
      project: "",
      workflow: "",
      labels: [],
    },
  })

  function onSubmit(values: CreateTaskFormValues) {
    createTask.mutate(
      {
        title: values.title,
        description: values.description,
        priority: values.priority,
        assigned_to: values.assigned_to || undefined,
        project: values.project || undefined,
        workflow: values.workflow || undefined,
        labels: values.labels.length > 0 ? values.labels : undefined,
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

      <div className="grid grid-cols-2 gap-3">
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

        <div className="flex flex-col gap-1.5">
          <Label className="font-heading text-xs">
            {t("tasks.create_assignee_label")}
          </Label>
          <Suspense fallback={<SelectSkeleton />}>
            <Controller
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <AssigneeSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="font-heading text-xs">
            {t("tasks.create_project_label")}
          </Label>
          <Suspense fallback={<SelectSkeleton />}>
            <Controller
              control={form.control}
              name="project"
              render={({ field }) => (
                <ProjectSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
          </Suspense>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="font-heading text-xs">
            {t("tasks.create_workflow_label")}
          </Label>
          <WorkflowSelect
            value={form.watch("workflow") ?? ""}
            onChange={(v) => form.setValue("workflow", v)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="font-heading text-xs">
          {t("tasks.create_labels_label")}
        </Label>
        <Controller
          control={form.control}
          name="labels"
          render={({ field }) => (
            <LabelsInput value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

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
