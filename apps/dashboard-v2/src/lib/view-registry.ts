import { lazy, type ComponentType } from "react"

/**
 * View registry — maps file path patterns to React viewer components.
 *
 * Resolution order (highest priority first):
 * 1. Company-layer views (priority >= 1000)
 * 2. Built-in specialized views (priority 100-999)
 * 3. Built-in generic views (priority 1-99)
 * 4. Raw text fallback (priority 0)
 */

export interface FileViewProps {
  /** Relative path within company root */
  path: string
  /** Raw file content as string (text files) */
  content: string
}

export interface FileViewRegistration {
  /** Glob-like pattern to match against file paths */
  pattern: string
  /** The React component to render */
  component: ComponentType<FileViewProps>
  /** Human-readable label for this view */
  label: string
  /** Higher priority wins. Company > specialized > generic > raw */
  priority: number
}

/**
 * Test whether a path matches a glob-like pattern.
 * Supports: **, *, exact segments, and file extensions.
 */
function matchPattern(pattern: string, path: string): boolean {
  // Normalize
  const normPattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "")
  const normPath = path.replace(/^\/+/, "").replace(/\/+$/, "")

  // Extension-only pattern like "*.md"
  if (normPattern.startsWith("*.")) {
    const ext = normPattern.slice(1)
    return normPath.endsWith(ext)
  }

  // Convert glob to regex
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

// ── Lazy-loaded built-in views ────────────────────────────────────────

const MarkdownView = lazy(() => import("@/features/files/views/markdown-view"))
const StructuredDataView = lazy(() => import("@/features/files/views/structured-data-view"))
const CodeView = lazy(() => import("@/features/files/views/code-view"))
const ImageView = lazy(() => import("@/features/files/views/image-view"))
const PdfView = lazy(() => import("@/features/files/views/pdf-view"))

// Specialized views
const WorkflowDiagramView = lazy(() => import("@/features/files/views/workflow-diagram-view"))
const AgentCardsView = lazy(() => import("@/features/files/views/agent-cards-view"))
const CompanySettingsView = lazy(() => import("@/features/files/views/company-settings-view"))
const SecretLockedView = lazy(() => import("@/features/files/views/secret-locked-view"))
const SkillDetailView = lazy(() => import("@/features/files/views/skill-detail-view"))
const WidgetPreviewView = lazy(() => import("@/features/files/views/widget-preview-view"))
const PinCardView = lazy(() => import("@/features/files/views/pin-card-view"))

// ── Registry ──────────────────────────────────────────────────────────

const builtInRegistry: FileViewRegistration[] = [
  // Specialized views (priority 100-999)
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
    pattern: "agents.yaml",
    component: AgentCardsView,
    label: "Agent Cards",
    priority: 500,
  },
  {
    pattern: "agents.yml",
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

  // Generic views (priority 1-99)
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

/** Company-layer views can be registered at runtime */
let companyRegistry: FileViewRegistration[] = []

export function registerCompanyView(registration: FileViewRegistration): void {
  companyRegistry.push({ ...registration, priority: Math.max(registration.priority, 1000) })
  // Sort by priority desc
  companyRegistry.sort((a, b) => b.priority - a.priority)
}

/**
 * Resolve the best viewer for a given file path.
 * Returns the matched registration, or null for raw fallback.
 */
export function resolveView(path: string): FileViewRegistration | null {
  // Check company views first (already sorted by priority)
  for (const reg of companyRegistry) {
    if (matchPattern(reg.pattern, path)) return reg
  }

  // Then built-in (sorted by priority desc)
  const sorted = [...builtInRegistry].sort((a, b) => b.priority - a.priority)
  for (const reg of sorted) {
    if (matchPattern(reg.pattern, path)) return reg
  }

  return null
}

/**
 * Get the file extension from a path.
 */
export function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf(".")
  const lastSlash = path.lastIndexOf("/")
  if (lastDot === -1 || lastDot < lastSlash) return ""
  return path.slice(lastDot + 1).toLowerCase()
}

/**
 * Check if a file path is a binary/media type that needs blob loading.
 */
export function isBinaryFile(path: string): boolean {
  const ext = getFileExtension(path)
  return ["png", "jpg", "jpeg", "gif", "svg", "pdf", "ico", "webp"].includes(ext)
}
