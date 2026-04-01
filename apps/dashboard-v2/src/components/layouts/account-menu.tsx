import { GenerativeAvatar } from '@questpie/avatar'
import { MoonIcon, MonitorIcon, SignOutIcon, SunIcon } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'

type ThemeValue = 'light' | 'dark' | 'system'

interface AccountMenuProps {
	triggerClassName?: string
	contentClassName?: string
	avatarClassName?: string
	align?: 'start' | 'center' | 'end'
	side?: 'bottom' | 'left' | 'right' | 'top'
	sideOffset?: number
	showName?: boolean
}

interface ThemeItem {
	value: ThemeValue
	labelKey: string
	icon: Icon
}

const themeItems: ThemeItem[] = [
	{ value: 'light', labelKey: 'nav.theme_light', icon: SunIcon },
	{ value: 'dark', labelKey: 'nav.theme_dark', icon: MoonIcon },
	{ value: 'system', labelKey: 'nav.theme_system', icon: MonitorIcon },
]

function getAvatarTheme(theme: ThemeValue): 'dark' | 'light' {
	if (theme === 'light') {
		return 'light'
	}

	return 'dark'
}

function isThemeValue(value: string): value is ThemeValue {
	return value === 'light' || value === 'dark' || value === 'system'
}

export function AccountMenu({
	triggerClassName,
	contentClassName,
	avatarClassName,
	align = 'end',
	side = 'bottom',
	sideOffset = 4,
	showName = false,
}: AccountMenuProps): React.JSX.Element {
	const { t } = useTranslation()
	const router = useRouter()
	const { data: session } = authClient.useSession()
	const theme = useAppStore((state) => state.theme)
	const setTheme = useAppStore((state) => state.setTheme)

	const userSeed = session?.user?.id ?? session?.user?.email ?? session?.user?.name ?? 'user'
	const userName = session?.user?.name ?? session?.user?.email ?? 'User'
	const userEmail = session?.user?.email ?? null
	const currentThemeItem = themeItems.find((item) => item.value === theme) ?? themeItems[2]
	const CurrentThemeIcon = currentThemeItem.icon

	function handleThemeChange(nextTheme: string): void {
		if (!isThemeValue(nextTheme)) {
			return
		}

		setTheme(nextTheme)
	}

	async function handleSignOut(): Promise<void> {
		try {
			await authClient.signOut()
			await router.invalidate()
			await router.navigate({ to: '/login' })
		} catch {
			toast.error(t('common.error'))
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						className={cn(
							'flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
							triggerClassName,
						)}
						title={userName}
						aria-label={t('nav.user_menu')}
					/>
				}
			>
				<GenerativeAvatar
					seed={userSeed}
					size={28}
					theme={getAvatarTheme(theme)}
					className={cn('size-7 shrink-0', avatarClassName)}
				/>
				{showName ? (
					<span className="max-w-28 truncate font-heading text-xs text-foreground">{userName}</span>
				) : null}
			</DropdownMenuTrigger>

			<DropdownMenuContent
				side={side}
				align={align}
				sideOffset={sideOffset}
				className={cn('w-56 min-w-56', contentClassName)}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="space-y-0.5 px-3 py-2 text-left">
						<div className="font-heading text-xs text-foreground">{userName}</div>
						{userEmail ? (
							<div className="text-[11px] text-muted-foreground">{userEmail}</div>
						) : null}
					</DropdownMenuLabel>
				</DropdownMenuGroup>

				<DropdownMenuSeparator />

				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<CurrentThemeIcon data-icon="inline-start" />
						{t('nav.theme')}
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
							{themeItems.map((item) => {
								const ThemeIcon = item.icon

								return (
									<DropdownMenuRadioItem key={item.value} value={item.value}>
										<ThemeIcon data-icon="inline-start" />
										{t(item.labelKey)}
									</DropdownMenuRadioItem>
								)
							})}
						</DropdownMenuRadioGroup>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={handleSignOut} variant="destructive">
					<SignOutIcon data-icon="inline-start" />
					{t('nav.sign_out')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
