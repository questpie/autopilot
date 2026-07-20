import { CheckIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@questpie/ui/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import { Item, ItemTitle } from "@questpie/ui/components/ui/item";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@questpie/ui/components/ui/select";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface AdaptiveSelectProps {
	label: string;
	options: readonly SelectOption[];
	value?: string | null;
	defaultValue?: string | null;
	placeholder?: string;
	selectedLabel?: string;
	disabled?: boolean;
	onValueChange?: (value: string | null) => void;
}

function AdaptiveSelect({
	label,
	options,
	value,
	defaultValue,
	placeholder = "Vyberte",
	selectedLabel = "Vybrané",
	disabled,
	onValueChange,
}: AdaptiveSelectProps) {
	const mobile = useIsMobile();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const initialOptionRef = useRef<HTMLButtonElement>(null);
	const [internalValue, setInternalValue] = useState(defaultValue ?? null);
	const currentValue = value === undefined ? internalValue : value;
	const selectedOption = options.find((option) => option.value === currentValue);
	const selectItems = [{ value: null, label: placeholder }, ...options];

	function choose(nextValue: string | null) {
		if (value === undefined) {
			setInternalValue(nextValue);
		}
		onValueChange?.(nextValue);
		setDrawerOpen(false);
	}

	if (mobile) {
		return (
			<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} showSwipeHandle>
				<DrawerTrigger
					render={
						<Button variant="secondary" disabled={disabled}>
							{selectedOption?.label ?? placeholder}
						</Button>
					}
				/>
				<DrawerContent initialFocus={initialOptionRef}>
					<DrawerHeader>
						<DrawerTitle>{label}</DrawerTitle>
					</DrawerHeader>
					<fieldset className="m-0 grid min-w-0 gap-1 border-0 px-4 pb-6" aria-label={label}>
						{options.map((option, index) => {
							const selected = option.value === currentValue;
							const firstEnabled = options.findIndex((candidate) => !candidate.disabled);
							const receivesInitialFocus = selected || (!selectedOption && index === firstEnabled);

							return (
								<Item
									key={option.value}
									render={
										<button
											type="button"
											ref={receivesInitialFocus ? initialOptionRef : undefined}
											aria-label={option.label}
											disabled={option.disabled}
											onClick={() => choose(option.value)}
										/>
									}
									data-selected={selected || undefined}
								>
									<ItemTitle>{option.label}</ItemTitle>
									{selected ? (
										<>
											<span className="sr-only">{selectedLabel}</span>
											<CheckIcon aria-hidden />
										</>
									) : null}
								</Item>
							);
						})}
					</fieldset>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Select items={selectItems} value={currentValue} onValueChange={choose} disabled={disabled}>
			<SelectTrigger aria-label={label}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false}>
				<SelectGroup>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value} disabled={option.disabled}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export { AdaptiveSelect };
