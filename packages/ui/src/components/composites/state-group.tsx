import { ObjectRow, type ObjectRowProps } from "@questpie/ui/components/composites/object-row";
import {
	QuickAddRow,
	type QuickAddRowProps,
} from "@questpie/ui/components/composites/quick-add-row";
import { Status, type StatusState } from "@questpie/ui/components/composites/status";
import { TechnicalTag } from "@questpie/ui/components/composites/technical-tag";

export interface StateGroupContextProjection {
	label: string;
	tone?: "neutral" | "live";
}

export interface StateGroupProps {
	id: string;
	label: string;
	count: number;
	tone?: StatusState;
	context?: StateGroupContextProjection;
	items: readonly Omit<ObjectRowProps, "onActivate">[];
	quickAdd?: Omit<QuickAddRowProps, "onAdd">;
	onOpenItem?: (id: string) => void;
	onSelectItem?: (id: string, checked: boolean) => void;
	selectionEnabled?: boolean;
	onQuickAdd?: () => void;
}

function StateGroup({
	id,
	label,
	count,
	tone = "idle",
	context,
	items,
	quickAdd,
	onOpenItem,
	onSelectItem,
	selectionEnabled = true,
	onQuickAdd,
}: StateGroupProps) {
	return (
		<section data-slot="state-group" data-group-id={id} aria-labelledby={`${id}-label`}>
			<header data-slot="state-group-header" className="work-state-group-header">
				<Status id={`${id}-label`} state={tone} label={label} />
				<TechnicalTag>{count}</TechnicalTag>
				{context ? (
					<span className="work-state-group-header__context" data-tone={context.tone ?? "neutral"}>
						{context.tone === "live" ? (
							<span className="work-row-status work-row-status--running" aria-hidden />
						) : null}
						{context.label}
					</span>
				) : null}
			</header>
			{quickAdd ? <QuickAddRow {...quickAdd} onAdd={onQuickAdd} /> : null}
			{items.map((item) => (
				<ObjectRow
					key={item.id}
					{...item}
					selection={
						item.selection && selectionEnabled
							? {
									...item.selection,
									onCheckedChange: (checked) => onSelectItem?.(item.id, checked),
								}
							: undefined
					}
					onActivate={onOpenItem ? () => onOpenItem(item.id) : undefined}
				/>
			))}
		</section>
	);
}

export { StateGroup };
