import { AnimatePresence, m } from "framer-motion"
import { UploadSimpleIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { DURATION, EASING } from "@/lib/motion"

interface FileDropOverlayProps {
  visible: boolean
  iconSize?: number
  textClassName?: string
}

/**
 * Animated overlay shown when native files are dragged over a drop target.
 * Must be rendered inside a `position: relative` container.
 */
export function FileDropOverlay({
  visible,
  iconSize = 32,
  textClassName = "text-sm",
}: FileDropOverlayProps) {
  const { t } = useTranslation()

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fast, ease: EASING.enter }}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-primary/40 bg-primary/5"
          role="status"
          aria-label={t("upload.drag_active")}
        >
          <div className="flex flex-col items-center gap-2 text-primary/70">
            <UploadSimpleIcon size={iconSize} />
            <span className={`font-heading ${textClassName}`}>
              {t("upload.drag_active")}
            </span>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
