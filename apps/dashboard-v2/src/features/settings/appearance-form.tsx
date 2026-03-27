import {
  MoonIcon,
  SunIcon,
  DesktopIcon,
  TextAaIcon,
  SidebarIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app.store"
import { FormSection } from "@/components/forms"
import { cn } from "@/lib/utils"

type Density = "comfortable" | "compact"
type FontSize = "small" | "default" | "large"

function useAppearanceStore() {
  // Use localStorage directly for appearance settings not already in app store
  const getItem = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback
    return localStorage.getItem(`questpie-${key}`) ?? fallback
  }
  const setItem = (key: string, value: string) => {
    localStorage.setItem(`questpie-${key}`, value)
  }

  return { getItem, setItem }
}

interface ToggleCardProps {
  label: string
  selected: boolean
  disabled?: boolean
  icon?: React.ReactNode
  onClick: () => void
}

function ToggleCard({ label, selected, disabled, icon, onClick }: ToggleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1.5 border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {icon}
      <span className="font-heading text-[10px] font-medium">{label}</span>
    </button>
  )
}

/**
 * Appearance settings — theme, density, sidebar, font size.
 * All settings persisted to localStorage and applied immediately.
 */
export function AppearanceForm() {
  const { t } = useTranslation()
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const store = useAppearanceStore()

  const density = store.getItem("density", "comfortable") as Density
  const fontSize = store.getItem("fontSize", "default") as FontSize

  const setDensity = (d: Density) => {
    store.setItem("density", d)
    document.documentElement.dataset.density = d
    // Force re-render
    window.dispatchEvent(new Event("storage"))
  }

  const setFontSize = (s: FontSize) => {
    store.setItem("fontSize", s)
    const sizes = { small: "13px", default: "14px", large: "16px" }
    document.documentElement.style.fontSize = sizes[s]
    window.dispatchEvent(new Event("storage"))
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      {/* Theme */}
      <FormSection title={t("settings.appearance_theme")}>
        <div className="grid grid-cols-3 gap-2">
          <ToggleCard
            label={t("settings.appearance_theme_dark")}
            selected={theme === "dark"}
            icon={<MoonIcon size={20} />}
            onClick={() => setTheme("dark")}
          />
          <ToggleCard
            label={t("settings.appearance_theme_light")}
            selected={theme === "light"}
            icon={<SunIcon size={20} />}
            disabled
            onClick={() => {}}
          />
          <ToggleCard
            label={t("settings.appearance_theme_system")}
            selected={theme === "system"}
            icon={<DesktopIcon size={20} />}
            disabled
            onClick={() => {}}
          />
        </div>
      </FormSection>

      {/* Density */}
      <FormSection title={t("settings.appearance_density")}>
        <div className="grid grid-cols-2 gap-2">
          <ToggleCard
            label={t("settings.appearance_density_comfortable")}
            selected={density === "comfortable"}
            icon={<ArrowsOutSimpleIcon size={20} />}
            onClick={() => setDensity("comfortable")}
          />
          <ToggleCard
            label={t("settings.appearance_density_compact")}
            selected={density === "compact"}
            icon={<ArrowsInSimpleIcon size={20} />}
            onClick={() => setDensity("compact")}
          />
        </div>
      </FormSection>

      {/* SidebarIcon */}
      <FormSection title={t("settings.appearance_sidebar")}>
        <div className="grid grid-cols-3 gap-2">
          <ToggleCard
            label={t("settings.appearance_sidebar_expanded")}
            selected={!sidebarCollapsed}
            icon={<SidebarIcon size={20} />}
            onClick={() => setSidebarCollapsed(false)}
          />
          <ToggleCard
            label={t("settings.appearance_sidebar_collapsed")}
            selected={sidebarCollapsed}
            icon={<SidebarIcon size={20} weight="thin" />}
            onClick={() => setSidebarCollapsed(true)}
          />
        </div>
      </FormSection>

      {/* Font Size */}
      <FormSection title={t("settings.appearance_font_size")}>
        <div className="grid grid-cols-3 gap-2">
          <ToggleCard
            label={t("settings.appearance_font_small")}
            selected={fontSize === "small"}
            icon={<TextAaIcon size={16} />}
            onClick={() => setFontSize("small")}
          />
          <ToggleCard
            label={t("settings.appearance_font_default")}
            selected={fontSize === "default"}
            icon={<TextAaIcon size={20} />}
            onClick={() => setFontSize("default")}
          />
          <ToggleCard
            label={t("settings.appearance_font_large")}
            selected={fontSize === "large"}
            icon={<TextAaIcon size={24} />}
            onClick={() => setFontSize("large")}
          />
        </div>
      </FormSection>
    </div>
  )
}
