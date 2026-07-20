import { useState } from "react";

import { Button, Field, FieldGroup, FieldLabel, Input, StateBand } from "@questpie/ui";

import type { SpaceCreateDraft } from "@/lib/data/commands/spaces";

export type CreateSpaceOutcome = { status: "created" } | { status: "recoverable"; message: string };

export type CreateSpaceDialogProps = {
	onClose: () => void;
	/** On "created" the parent navigates; on "recoverable" the name is kept. */
	onSubmit: (draft: SpaceCreateDraft) => Promise<CreateSpaceOutcome>;
};

/**
 * Create-space surface — adaptive by CSS: a bottom sheet below 768px, a centered
 * dialog above. Rendered only while open (client-only), so it never enters the
 * SSR stream. Keeps the typed name intact on a recoverable failure (SPEC 10.3).
 */
export function CreateSpaceDialog({ onClose, onSubmit }: CreateSpaceDialogProps) {
	const [name, setName] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		if (pending || name.trim().length < 2) return;
		setPending(true);
		setError(null);
		const outcome = await onSubmit({ name });
		if (outcome.status === "recoverable") {
			setError(outcome.message);
			setPending(false);
			return;
		}
		// "created": stay pending — the parent closes and navigates.
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Nový priestor"
		>
			<button
				type="button"
				aria-label="Zavrieť"
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
			/>
			<div className="relative w-full max-w-md rounded-t-lg border border-hairline bg-background p-4 md:rounded-lg">
				<h2 className="text-lg font-semibold">Nový priestor</h2>
				{error ? (
					<div className="mt-2">
						<StateBand tone="danger" label={error} />
					</div>
				) : null}
				<div className="mt-3">
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="space-name">Názov priestoru</FieldLabel>
							<Input
								id="space-name"
								value={name}
								disabled={pending}
								minLength={2}
								maxLength={160}
								placeholder="Marketing"
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
					</FieldGroup>
				</div>
				<div className="mt-4 flex justify-end gap-2">
					<Button variant="ghost" onClick={onClose} disabled={pending}>
						Zrušiť
					</Button>
					<Button
						onClick={() => {
							void submit();
						}}
						disabled={pending || name.trim().length < 2}
					>
						{pending ? "Vytváram…" : "Vytvoriť"}
					</Button>
				</div>
			</div>
		</div>
	);
}
