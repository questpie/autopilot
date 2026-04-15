import { useAppStore } from '@/stores/app.store'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { changeLanguage } from '@/lib/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/hooks/use-session'
import { ProfileSettings } from './profile-settings'
import { SecuritySettings } from './security-settings'
import { UsersSettings } from './users-settings'

// ── Section wrapper ───────────────────────────────────────────────────────────

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="bg-muted/40">
      <div className="bg-muted/30 px-4 py-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Setting row ───────────────────────────────────────────────────────────────

interface SettingRowProps {
  label: string
  description?: string
  control: React.ReactNode
}

function SettingRow({ label, description, control }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="ml-4 shrink-0">{control}</div>
    </div>
  )
}

// ── Theme option button ───────────────────────────────────────────────────────

type Theme = 'dark' | 'light' | 'system'

interface ThemeOptionProps {
  value: Theme
  label: string
  current: Theme
  onSelect: (theme: Theme) => void
}

function ThemeOption({ value, label, current, onSelect }: ThemeOptionProps) {
  const isActive = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'px-3 py-1.5 font-mono text-xs transition-colors',
        isActive
          ? 'bg-foreground text-background'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ── Locale option button ──────────────────────────────────────────────────────

type Locale = 'sk' | 'en' | 'auto'

interface LocaleOptionProps {
  value: Locale
  label: string
  current: Locale
  onSelect: (locale: Locale) => void
}

function LocaleOption({ value, label, current, onSelect }: LocaleOptionProps) {
  const isActive = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'px-3 py-1.5 font-mono text-xs transition-colors',
        isActive
          ? 'bg-foreground text-background'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

// ── App preferences tab ───────────────────────────────────────────────────────

function AppPreferencesTab() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const locale = useAppStore((s) => s.locale) as Locale
  const setLocale = useAppStore((s) => s.setLocale)
  const developerMode = useAppStore((s) => s.developerMode)
  const setDeveloperMode = useAppStore((s) => s.setDeveloperMode)

  function handleThemeChange(next: Theme) {
    setTheme(next)
  }

  function handleLocaleChange(next: Locale) {
    setLocale(next)
    changeLanguage(next)
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Appearance">
        <SettingRow
          label="Theme"
          description="Controls the color scheme of the interface"
          control={
            <div className="flex gap-1">
              <ThemeOption value="dark" label="Dark" current={theme} onSelect={handleThemeChange} />
              <ThemeOption value="light" label="Light" current={theme} onSelect={handleThemeChange} />
              <ThemeOption value="system" label="System" current={theme} onSelect={handleThemeChange} />
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="Language">
        <SettingRow
          label="Interface language"
          description="The language used throughout the UI"
          control={
            <div className="flex gap-1">
              <LocaleOption value="auto" label="Auto" current={locale} onSelect={handleLocaleChange} />
              <LocaleOption value="en" label="English" current={locale} onSelect={handleLocaleChange} />
              <LocaleOption value="sk" label="Slovenčina" current={locale} onSelect={handleLocaleChange} />
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="Developer">
        <SettingRow
          label="Developer mode"
          description="Show advanced sections in navigation (Files, Agents, Workflows, Runtime)"
          control={
            <ToggleSwitch checked={developerMode} onChange={setDeveloperMode} />
          }
        />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingRow
          label="Version"
          control={
            <span className="font-mono text-xs text-muted-foreground">
              QUESTPIE Autopilot v2
            </span>
          }
        />
      </SettingsSection>
    </div>
  )
}

// ── Settings screen ───────────────────────────────────────────────────────────

export function SettingsScreen() {
  useSetLayoutMode('default')
  const { user } = useSession()

  const canManageUsers = user?.role === 'owner' || user?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <p className="font-mono text-lg font-medium text-foreground">Settings</p>
        <p className="font-mono text-xs text-muted-foreground">
          Profile, security, and application preferences
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {canManageUsers && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="security" className="pt-4">
          <SecuritySettings />
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="users" className="pt-4">
            <UsersSettings />
          </TabsContent>
        )}

        <TabsContent value="preferences" className="pt-4">
          <AppPreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
