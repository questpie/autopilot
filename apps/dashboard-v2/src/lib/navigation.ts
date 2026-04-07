export type AppSection = "channels" | "workflow" | "fs"

export function getActiveSection(pathname: string | undefined | null): AppSection {
  const currentPath = pathname ?? "/"

  if (currentPath === "/workflow" || currentPath.startsWith("/workflow/")) {
    return "workflow"
  }

  if (currentPath === "/fs" || currentPath.startsWith("/fs/")) {
    return "fs"
  }

  return "channels"
}

export function getSectionRoot(section: AppSection): string {
  switch (section) {
    case "workflow":
      return "/workflow"
    case "fs":
      return "/fs"
    default:
      return "/"
  }
}

export function getSectionLabelKey(section: AppSection): string {
  switch (section) {
    case "workflow":
      return "nav.workflow"
    case "fs":
      return "nav.fs"
    default:
      return "nav.channels"
  }
}
