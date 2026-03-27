import { DesktopIcon, DeviceTabletIcon, DeviceMobileIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { useHapticPattern } from "@/hooks/use-haptic"

export type ViewportSize = "desktop" | "tablet" | "mobile"

const VIEWPORT_SIZES: Record<ViewportSize, { width: string; label: string }> = {
  desktop: { width: "100%", label: "artifacts.viewport_desktop" },
  tablet: { width: "768px", label: "artifacts.viewport_tablet" },
  mobile: { width: "375px", label: "artifacts.viewport_mobile" },
}

interface ViewportSwitcherProps {
  value: ViewportSize
  onChange: (size: ViewportSize) => void
}

export function ViewportSwitcher({ value, onChange }: ViewportSwitcherProps) {
  const { t } = useTranslation()
  const { trigger: haptic } = useHapticPattern()

  const viewports: Array<{ key: ViewportSize; icon: typeof DesktopIcon }> = [
    { key: "desktop", icon: DesktopIcon },
    { key: "tablet", icon: DeviceTabletIcon },
    { key: "mobile", icon: DeviceMobileIcon },
  ]

  return (
    <div className="flex items-center gap-1">
      {viewports.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          variant={value === key ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            haptic("tap")
            onChange(key)
          }}
          className="h-7 w-7 rounded-none p-0"
          title={t(VIEWPORT_SIZES[key].label)}
        >
          <Icon size={14} />
        </Button>
      ))}
    </div>
  )
}

export { VIEWPORT_SIZES }
