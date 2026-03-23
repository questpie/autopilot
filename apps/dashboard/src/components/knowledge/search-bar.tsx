import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
	value: string
	onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
	return (
		<div className="relative px-2 py-2">
			<MagnifyingGlass
				size={14}
				className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search..."
				className="pl-8 h-8 text-[13px]"
			/>
			{value && (
				<button
					onClick={() => onChange('')}
					className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
				>
					<X size={12} />
				</button>
			)}
		</div>
	)
}
