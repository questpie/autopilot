import { PlusIcon } from "lucide-react";

export interface QuickAddRowProps {
	label: string;
	shortcut?: string;
	disabled?: boolean;
	onAdd?: () => void;
}

function QuickAddRow({ label, shortcut, disabled, onAdd }: QuickAddRowProps) {
	return (
		<button
			type="button"
			aria-label={label}
			data-slot="work-quick-add-row"
			className="work-quick-add-row"
			disabled={disabled}
			onClick={onAdd}
		>
			<PlusIcon aria-hidden />
			<span>{label}</span>
			{shortcut ? <kbd>{shortcut}</kbd> : null}
		</button>
	);
}

export { QuickAddRow };
