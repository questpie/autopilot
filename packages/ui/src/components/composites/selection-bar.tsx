import { ListChecksIcon, type LucideIcon } from "lucide-react";

import { AdaptiveMenu } from "@questpie/ui/components/composites/adaptive-menu";
import { Button } from "@questpie/ui/components/ui/button";
import { Checkbox } from "@questpie/ui/components/ui/checkbox";

export interface SelectionBarAction {
	id: string;
	label: string;
	icon?: LucideIcon;
	onSelect?: () => void;
}

export interface SelectionBarProps {
	count: number;
	context?: string;
	actions: readonly SelectionBarAction[];
	onClear?: () => void;
}

function SelectionBar({ count, context, actions, onClear }: SelectionBarProps) {
	return (
		<div data-slot="work-selection-bar" className="work-selection-bar">
			<Checkbox checked aria-label="Vybrané úlohy" />
			<strong>{count} vybrané</strong>
			<span className="text-ink-faint" aria-hidden>
				·
			</span>
			<div className="work-selection-bar__compact-actions">
				<AdaptiveMenu
					label="Akcie výberu"
					items={actions.map(({ id, label, onSelect }) => ({ id, label, onSelect }))}
					trigger={
						<Button variant="ghost" size="sm" aria-label="Akcie výberu">
							<ListChecksIcon data-icon="inline-start" aria-hidden />
							Akcie
						</Button>
					}
				/>
			</div>
			<div className="work-selection-bar__wide-actions">
				{actions.map(({ id, label, icon: Icon, onSelect }) => (
					<Button key={id} variant="ghost" size="sm" onClick={onSelect}>
						{Icon ? <Icon data-icon="inline-start" aria-hidden /> : null}
						{label}
					</Button>
				))}
			</div>
			{context ? <span className="work-selection-bar__context">{context}</span> : null}
			<Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
				Zrušiť výber
			</Button>
		</div>
	);
}

export { SelectionBar };
