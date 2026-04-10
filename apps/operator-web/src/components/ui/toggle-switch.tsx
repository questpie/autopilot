import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
}

export function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-success' : 'bg-border'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-sm bg-white transition-transform duration-150',
          checked ? 'translate-x-[20px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}
