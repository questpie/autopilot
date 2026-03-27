import { useTranslation } from "@/lib/i18n"

/**
 * Skip-to-main-content link for screen readers and keyboard users.
 * Visually hidden until focused, then slides in from top.
 */
export function SkipLink() {
  const { t } = useTranslation()

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-none focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:font-heading focus:text-sm focus:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {t("accessibility.skip_to_content")}
    </a>
  )
}
