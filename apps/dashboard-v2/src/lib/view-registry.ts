import { lazy, type ComponentType } from "react"

export interface FileViewProps {
  path: string
  content: string
}

export interface FileViewRegistration {
  pattern: string
  component: ComponentType<FileViewProps>
  label: string
  priority: number
}

function matchPattern(pattern: string, path: string): boolean {
  const normPattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "")
  const normPath = path.replace(/^\/+/, "").replace(/\/+$/, "")

  if (normPattern.startsWith("*.")) {
    const ext = normPattern.slice(1)
    return normPath.endsWith(ext)
  }

  const regexStr = normPattern
    .split("/")
    .map((segment) => {
      if (segment === "**") return ".*"
      return segment
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
    })
    .join("/")

  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(normPath)
}

const MarkdownView = lazy(() => import("@/features/files/views/markdown-view"))
const StructuredDataView = lazy(() => import("@/features/files/views/structured-data-view"))
const CodeView = lazy(() => import("@/features/files/views/code-view"))
const ImageView = lazy(() => import("@/features/files/views/image-view"))
const PdfView = lazy(() => import("@/features/files/views/pdf-view"))

const WorkflowDiagramView = lazy(() => import("@/features/files/views/workflow-diagram-view"))
const AgentCardsView = lazy(() => import("@/features/files/views/agent-cards-view"))
const RoleEditorView = lazy(() => import("@/features/files/views/role-editor-view"))
const CompanySettingsView = lazy(() => import("@/features/files/views/company-settings-view"))
const SecretLockedView = lazy(() => import("@/features/files/views/secret-locked-view"))
const SkillDetailView = lazy(() => import("@/features/files/views/skill-detail-view"))
const WidgetPreviewView = lazy(() => import("@/features/files/views/widget-preview-view"))
const PinCardView = lazy(() => import("@/features/files/views/pin-card-view"))

const builtInRegistry: FileViewRegistration[] = [
  {
    pattern: "team/roles/*.md",
    component: RoleEditorView,
    label: "Role Editor",
    priority: 500,
  },
  {
    pattern: "workflows/*.yaml",
    component: WorkflowDiagramView,
    label: "Workflow Diagram",
    priority: 500,
  },
  {
    pattern: "workflows/*.yml",
    component: WorkflowDiagramView,
    label: "Workflow Diagram",
    priority: 500,
  },
  {
    pattern: "team/agents.yaml",
    component: AgentCardsView,
    label: "Agent Cards",
    priority: 500,
  },
  {
    pattern: "team/agents.yml",
    component: AgentCardsView,
    label: "Agent Cards",
    priority: 500,
  },
  {
    pattern: "company.yaml",
    component: CompanySettingsView,
    label: "Company Settings",
    priority: 500,
  },
  {
    pattern: "company.yml",
    component: CompanySettingsView,
    label: "Company Settings",
    priority: 500,
  },
  {
    pattern: "secrets/**/*.yaml",
    component: SecretLockedView,
    label: "Secret (Locked)",
    priority: 500,
  },
  {
    pattern: "secrets/**/*.yml",
    component: SecretLockedView,
    label: "Secret (Locked)",
    priority: 500,
  },
  {
    pattern: "skills/**/SKILL.md",
    component: SkillDetailView,
    label: "Skill Detail",
    priority: 500,
  },
  {
    pattern: "dashboard/widgets/**/widget.yaml",
    component: WidgetPreviewView,
    label: "Widget Preview",
    priority: 500,
  },
  {
    pattern: "dashboard/widgets/**/widget.yml",
    component: WidgetPreviewView,
    label: "Widget Preview",
    priority: 500,
  },
  {
    pattern: "dashboard/pins/**/*.yaml",
    component: PinCardView,
    label: "Pin Card",
    priority: 500,
  },
  {
    pattern: "dashboard/pins/**/*.yml",
    component: PinCardView,
    label: "Pin Card",
    priority: 500,
  },

  { pattern: "*.md", component: MarkdownView, label: "Markdown", priority: 50 },
  { pattern: "*.yaml", component: StructuredDataView, label: "YAML", priority: 40 },
  { pattern: "*.yml", component: StructuredDataView, label: "YAML", priority: 40 },
  { pattern: "*.json", component: StructuredDataView, label: "JSON", priority: 40 },
  { pattern: "*.png", component: ImageView, label: "Image", priority: 30 },
  { pattern: "*.jpg", component: ImageView, label: "Image", priority: 30 },
  { pattern: "*.jpeg", component: ImageView, label: "Image", priority: 30 },
  { pattern: "*.gif", component: ImageView, label: "Image", priority: 30 },
  { pattern: "*.svg", component: ImageView, label: "Image", priority: 30 },
  { pattern: "*.pdf", component: PdfView, label: "PDF", priority: 30 },
  { pattern: "*.ts", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.tsx", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.js", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.jsx", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.css", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.html", component: CodeView, label: "Code", priority: 20 },
  { pattern: "*.txt", component: CodeView, label: "Text", priority: 10 },
  { pattern: "*.csv", component: CodeView, label: "CSV", priority: 10 },
]

let companyRegistry: FileViewRegistration[] = []

const builtInSorted = [...builtInRegistry].sort((a, b) => b.priority - a.priority)

export function registerCompanyView(registration: FileViewRegistration): void {
  companyRegistry.push({ ...registration, priority: Math.max(registration.priority, 1000) })
  companyRegistry.sort((a, b) => b.priority - a.priority)
}

export function resolveView(path: string): FileViewRegistration | null {
  for (const reg of companyRegistry) {
    if (matchPattern(reg.pattern, path)) return reg
  }

  for (const reg of builtInSorted) {
    if (matchPattern(reg.pattern, path)) return reg
  }

  return null
}

export function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".")
  const lastSlash = path.lastIndexOf("/")
  if (lastDot === -1 || lastDot < lastSlash) return ""
  return path.slice(lastDot + 1).toLowerCase()
}

export function isBinaryFile(path: string): boolean {
  const ext = getFileExtension(path)
  return ["png", "jpg", "jpeg", "gif", "svg", "pdf", "ico", "webp"].includes(ext)
}
