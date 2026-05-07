/**
 * Environment setup wizard.
 *
 * Environments group worker tag requirements and secret refs under a stable
 * ID that workflow steps reference via targeting.environment.
 *
 * Form fields map 1:1 to EnvironmentSchema in packages/spec.
 */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SurfaceSection } from '@/components/ui/surface-section'
import { Textarea } from '@/components/ui/textarea'
import { useEffect, useMemo, useState } from 'react'
import {
	parseSecretRefs,
	type SecretRefDraft,
	SecretRefEditor,
	serializeSecretRefs,
} from './secret-ref-editor'

interface EnvironmentWizardProps {
	value: string
	onChange: (next: string) => void
	draftId: string
	onDraftIdChange: (next: string) => void
}

interface EnvironmentDraft {
	id: string
	name: string
	description: string
	required_tags: string[]
	secret_refs: SecretRefDraft[]
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === 'string')
}

function parseDraft(value: string, fallbackId: string): EnvironmentDraft {
	if (!value.trim()) {
		return { id: fallbackId, name: '', description: '', required_tags: [], secret_refs: [] }
	}
	try {
		const raw = JSON.parse(value) as Record<string, unknown>
		return {
			id: asString(raw.id) ?? fallbackId,
			name: asString(raw.name) ?? '',
			description: asString(raw.description) ?? '',
			required_tags: asStringArray(raw.required_tags),
			secret_refs: parseSecretRefs(raw.secret_refs),
		}
	} catch {
		return { id: fallbackId, name: '', description: '', required_tags: [], secret_refs: [] }
	}
}

function serializeDraft(draft: EnvironmentDraft): string {
	return JSON.stringify(
		{
			id: draft.id,
			name: draft.name,
			description: draft.description,
			required_tags: draft.required_tags,
			secret_refs: serializeSecretRefs(draft.secret_refs),
		},
		null,
		2,
	)
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function parseCsv(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean)
}

export function EnvironmentSetupWizard({
	value,
	onChange,
	draftId,
	onDraftIdChange,
}: EnvironmentWizardProps) {
	const parsed = useMemo(() => parseDraft(value, draftId), [draftId, value])
	const [draft, setDraft] = useState<EnvironmentDraft>(parsed)

	useEffect(() => {
		setDraft(parsed)
	}, [parsed])

	function applyChange(next: EnvironmentDraft) {
		setDraft(next)
		onDraftIdChange(next.id)
		onChange(serializeDraft(next))
	}

	function update(patch: Partial<EnvironmentDraft>) {
		applyChange({ ...draft, ...patch })
	}

	function updateName(name: string) {
		const id = draft.id ? draft.id : toSlug(name)
		applyChange({ ...draft, name, id })
	}

	return (
		<div className="space-y-4">
			<SurfaceSection
				title="Environment"
				description="Workers must advertise the required tags to be eligible. Secrets resolve through the worker's local config or the orchestrator's shared store."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1">
						<Label>Environment ID</Label>
						<Input
							aria-label="Environment ID"
							value={draft.id}
							onChange={(e) => update({ id: toSlug(e.target.value) })}
							placeholder="staging"
						/>
					</div>
					<div className="space-y-1">
						<Label>Display name</Label>
						<Input
							aria-label="Environment name"
							value={draft.name}
							onChange={(e) => updateName(e.target.value)}
							placeholder="Staging"
						/>
					</div>
					<div className="md:col-span-2 space-y-1">
						<Label>Description</Label>
						<Textarea
							aria-label="Environment description"
							value={draft.description}
							onChange={(e) => update({ description: e.target.value })}
							placeholder="What this environment is for, what runs in it, what limits apply."
							className="min-h-20 resize-y"
						/>
					</div>
					<div className="md:col-span-2 space-y-1">
						<Label>Required worker tags (comma separated)</Label>
						<Input
							aria-label="Required worker tags"
							value={draft.required_tags.join(', ')}
							onChange={(e) => update({ required_tags: parseCsv(e.target.value) })}
							placeholder="staging, mac, gpu"
						/>
					</div>
				</div>
			</SurfaceSection>

			<SurfaceSection
				title="Secrets"
				description="Reference secrets by name. Local refs (env/file/exec) resolve on the worker; shared refs come from the orchestrator's encrypted store."
				contentClassName="space-y-2"
			>
				<SecretRefEditor
					values={draft.secret_refs}
					onChange={(next) => update({ secret_refs: next })}
				/>
			</SurfaceSection>
		</div>
	)
}
