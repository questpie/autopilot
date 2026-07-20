import { CheckIcon, SearchIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "@questpie/ui/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@questpie/ui/components/ui/combobox";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@questpie/ui/components/ui/drawer";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@questpie/ui/components/ui/input-group";
import { Item, ItemTitle } from "@questpie/ui/components/ui/item";
import { useIsMobile } from "@questpie/ui/hooks/use-mobile";

export interface ComboboxOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface AdaptiveComboboxProps {
	label: string;
	options: readonly ComboboxOption[];
	value?: string | null;
	defaultValue?: string | null;
	placeholder?: string;
	emptyLabel?: string;
	openLabel?: string;
	clearLabel?: string;
	selectedLabel?: string;
	disabled?: boolean;
	onValueChange?: (value: string | null) => void;
}

function AdaptiveCombobox({
	label,
	options,
	value,
	defaultValue,
	placeholder = "Hľadať…",
	emptyLabel = "Žiadne výsledky",
	openLabel = "Otvoriť možnosti",
	clearLabel = "Vymazať výber",
	selectedLabel = "Vybrané",
	disabled,
	onValueChange,
}: AdaptiveComboboxProps) {
	const mobile = useIsMobile();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [internalValue, setInternalValue] = useState(defaultValue ?? null);
	const currentValue = value === undefined ? internalValue : value;
	const selectedOption = options.find((option) => option.value === currentValue);
	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		if (!normalizedQuery) return options;
		return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery));
	}, [options, query]);

	function choose(nextValue: string | null) {
		if (value === undefined) {
			setInternalValue(nextValue);
		}
		onValueChange?.(nextValue);
		setDrawerOpen(false);
		setQuery("");
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
				<DrawerContent initialFocus={searchRef}>
					<DrawerHeader>
						<DrawerTitle>{label}</DrawerTitle>
					</DrawerHeader>
					<div className="sticky top-0 px-4 py-3">
						<InputGroup>
							<InputGroupAddon>
								<SearchIcon aria-hidden />
							</InputGroupAddon>
							<InputGroupInput
								ref={searchRef}
								aria-label={label}
								value={query}
								onChange={(event) => setQuery(event.currentTarget.value)}
								placeholder={placeholder}
							/>
						</InputGroup>
					</div>
					<fieldset
						className="m-0 grid min-w-0 gap-1 overflow-y-auto border-0 px-4 pb-6"
						aria-label={label}
					>
						{filteredOptions.map((option) => {
							const selected = option.value === currentValue;

							return (
								<Item
									key={option.value}
									render={
										<button
											type="button"
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
						{filteredOptions.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
						) : null}
					</fieldset>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Combobox
			items={options.map((option) => option.value)}
			value={currentValue}
			onValueChange={(nextValue) => choose(nextValue)}
			itemToStringValue={(itemValue) =>
				options.find((option) => option.value === itemValue)?.label ?? ""
			}
			disabled={disabled}
		>
			<ComboboxInput
				placeholder={placeholder}
				aria-label={label}
				triggerLabel={openLabel}
				clearLabel={clearLabel}
				showClear
			/>
			<ComboboxContent>
				<ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
				<ComboboxList>
					{options.map((option) => (
						<ComboboxItem key={option.value} value={option.value} disabled={option.disabled}>
							{option.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}

export { AdaptiveCombobox };
