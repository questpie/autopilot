import type { ReactNode } from "react";

import { FieldGroup } from "@questpie/ui/components/ui/field";
import { Separator } from "@questpie/ui/components/ui/separator";

function SettingsForm({
	title,
	status,
	children,
	footer,
	onSubmit,
}: {
	title: string;
	status?: ReactNode;
	children: ReactNode;
	footer: ReactNode;
	onSubmit?: () => void;
}) {
	return (
		<form
			className="mx-auto grid max-w-3xl p-4"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit?.();
			}}
		>
			<header className="flex items-center justify-between gap-3 py-4">
				<h2 className="text-lg font-medium">{title}</h2>
				{status}
			</header>
			<Separator />
			<FieldGroup className="py-6">{children}</FieldGroup>
			<Separator />
			<footer className="flex justify-end gap-3 py-4">{footer}</footer>
		</form>
	);
}
export { SettingsForm };
