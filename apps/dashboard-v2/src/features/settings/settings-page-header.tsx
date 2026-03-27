interface SettingsPageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

/**
 * Consistent header for all settings sub-pages.
 */
export function SettingsPageHeader({ title, description, actions }: SettingsPageHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-border px-6 py-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
