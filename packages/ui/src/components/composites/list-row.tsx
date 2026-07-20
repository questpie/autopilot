import type { ReactNode } from "react";

import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@questpie/ui/components/ui/item";

export interface ListRowProps {
	leading?: ReactNode;
	identity: ReactNode;
	meta?: ReactNode;
	trailing?: ReactNode;
	selected?: boolean;
	disabled?: boolean;
	onActivate?: () => void;
}

function ListRow({
	leading,
	identity,
	meta,
	trailing,
	selected,
	disabled,
	onActivate,
}: ListRowProps) {
	return (
		<Item
			render={
				onActivate ? (
					<button
						type="button"
						onClick={onActivate}
						disabled={disabled}
						aria-label={typeof identity === "string" ? identity : "Otvoriť položku"}
					/>
				) : undefined
			}
			data-selected={selected || undefined}
			aria-disabled={disabled || undefined}
			variant={selected ? "muted" : "default"}
			size="sm"
		>
			{leading ? <ItemMedia>{leading}</ItemMedia> : null}
			<ItemContent>
				<ItemTitle>{identity}</ItemTitle>
				{meta ? <ItemDescription>{meta}</ItemDescription> : null}
			</ItemContent>
			{trailing ? <ItemActions>{trailing}</ItemActions> : null}
		</Item>
	);
}

export { ListRow };
