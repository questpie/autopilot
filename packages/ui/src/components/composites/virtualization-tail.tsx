import { Button } from "@questpie/ui/components/ui/button";
import { Spinner } from "@questpie/ui/components/ui/spinner";

export interface VirtualizationTailProps {
	count: number;
	label: string;
	state?: "ready" | "loading" | "error";
	actionLabel?: string;
	onAction?: () => void;
}

function VirtualizationTail({
	count,
	label,
	state = "ready",
	actionLabel,
	onAction,
}: VirtualizationTailProps) {
	return (
		<div
			data-slot="work-virtualization-tail"
			data-page-state={state}
			className="work-virtualization-tail"
		>
			<span className="min-w-0 truncate">
				<span aria-hidden>＋</span> <span className="ui-mono">{count}</span> {label}
			</span>
			{actionLabel ? (
				<Button variant="ghost" size="sm" disabled={state === "loading"} onClick={onAction}>
					{state === "loading" ? <Spinner data-icon="inline-start" /> : null}
					{actionLabel}
				</Button>
			) : null}
		</div>
	);
}

export { VirtualizationTail };
