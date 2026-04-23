import { useNavigate, useSearch } from '@tanstack/react-router'
import type { AppLocale as Locale, AppTheme as Theme } from '@/stores/app.store'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ToggleSwitch } from '@/components/ui/toggle-switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SurfaceSection } from '@/components/ui/surface-section'
import { useAppPreferences } from '@/hooks/use-app-preferences'
import { useSession } from '@/hooks/use-session'
import { MachinesSettings } from './machines-settings'
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
    <SurfaceSection title={title} contentClassName="p-0">
      {children}
    </SurfaceSection>
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
    <div className="flex items-center justify-between gap-6 px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      <div className="ml-4 shrink-0">{control}</div>
    </div>
  )
}

// ── App preferences tab ───────────────────────────────────────────────────────

function AppPreferencesTab() {
  const { theme, setTheme, locale, setLocale, developerMode, setDeveloperMode } = useAppPreferences()

  return (
    <div className="space-y-6">
      <SettingsSection title="Appearance">
        <SettingRow
          label="Theme"
          description="Controls the color scheme of the interface"
          control={
            <ToggleGroup
              value={[theme]}
              onValueChange={(value) => {
                if (value[0]) setTheme(value[0] as Theme)
              }}
              variant="outline"
              size="sm"
              spacing={1}
            >
              <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
              <ToggleGroupItem value="light">Light</ToggleGroupItem>
              <ToggleGroupItem value="system">System</ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </SettingsSection>

      <SettingsSection title="Language">
        <SettingRow
          label="Interface language"
          description="The language used throughout the UI"
          control={
            <ToggleGroup
              value={[locale]}
              onValueChange={(value) => {
                if (value[0]) setLocale(value[0] as Locale)
              }}
              variant="outline"
              size="sm"
              spacing={1}
            >
              <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
              <ToggleGroupItem value="en">English</ToggleGroupItem>
              <ToggleGroupItem value="sk">Slovenčina</ToggleGroupItem>
            </ToggleGroup>
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
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authed/settings' })

  const canManageUsers = user?.role === 'owner' || user?.role === 'admin'
  const canManageMachines = canManageUsers
  const activeTab = search.tab ?? 'profile'

  if (activeTab === 'machines') {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-2xl font-semibold text-foreground">Machines</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Worker connections, join tokens, and machine enrollment.
          </p>
        </div>

        <MachinesSettings canManageMachines={canManageMachines} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div>
        <p className="text-2xl font-semibold text-foreground">Settings</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Profile, security, and application preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => void navigate({ to: '/settings', search: { tab: value as 'profile' | 'security' | 'users' | 'preferences' | 'machines' } })}>
        <TabsList>
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
