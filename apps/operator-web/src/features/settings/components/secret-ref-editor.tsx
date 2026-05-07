/**
 * Reusable secret-ref editor used by provider and environment wizards.
 *
 * Renders a list of {name, source, key, description} rows. Shared refs are
 * orchestrator-managed (no `key`); local refs (env/file/exec) carry a `key`
 * the worker resolves locally.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

export type SecretSource = 'env' | 'file' | 'exec' | 'shared'

export interface SecretRefDraft {
	name: string
	source: SecretSource
	key?: string
	description?: string
}

interface SecretRefEditorProps {
	values: SecretRefDraft[]
	onChange: (next: SecretRefDraft[]) => void
}

export function SecretRefEditor({ values, onChange }: SecretRefEditorProps) {
	function add() {
		onChange([...values, { name: '', source: 'env', key: '' }])
	}

	function update(index: number, patch: Partial<SecretRefDraft>) {
		const next = [...values]
		const merged = { ...next[index]!, ...patch } as SecretRefDraft
		// Shared refs have no `key`; clear it if source switched to shared.
		if (merged.source === 'shared') merged.key = undefined
		else if (!merged.key) merged.key = ''
		next[index] = merged
		onChange(next)
	}

	function remove(index: number) {
		onChange(values.filter((_, i) => i !== index))
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label>Secret refs</Label>
				<Button type="button" size="sm" variant="outline" onClick={add}>
					<Plus className="size-3.5" />
					Add ref
				</Button>
			</div>

			{values.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No secret refs. Add one only when a handler or worker tag actually needs a value.
				</p>
			) : null}

			{values.map((ref, index) => (
				<div
					key={index}
					className="grid gap-2 rounded-lg border border-border/60 bg-card/30 p-3 md:grid-cols-[140px_120px_1fr_auto]"
				>
					<div className="space-y-1">
						<Label>Name</Label>
						<Input
							aria-label={`Secret name ${index + 1}`}
							value={ref.name}
							onChange={(e) => update(index, { name: e.target.value })}
							placeholder="TELEGRAM_BOT_TOKEN"
						/>
					</div>
					<div className="space-y-1">
						<Label>Source</Label>
						<Select
							aria-label={`Secret source ${index + 1}`}
							value={ref.source}
							onChange={(e) => update(index, { source: e.target.value as SecretSource })}
						>
							<option value="env">env</option>
							<option value="file">file</option>
							<option value="exec">exec</option>
							<option value="shared">shared</option>
						</Select>
					</div>
					<div className="space-y-1">
						<Label>{ref.source === 'shared' ? 'Description' : 'Key / path / cmd'}</Label>
						{ref.source === 'shared' ? (
							<Input
								aria-label={`Secret description ${index + 1}`}
								value={ref.description ?? ''}
								onChange={(e) => update(index, { description: e.target.value })}
								placeholder="Optional description"
							/>
						) : (
							<Input
								aria-label={`Secret key ${index + 1}`}
								value={ref.key ?? ''}
								onChange={(e) => update(index, { key: e.target.value })}
								placeholder={
									ref.source === 'env'
										? 'TELEGRAM_BOT_TOKEN'
										: ref.source === 'file'
											? '/etc/secrets/telegram'
											: 'op read op://...'
								}
							/>
						)}
					</div>
					<div className="flex items-end justify-end">
						<Button
							type="button"
							size="icon"
							variant="ghost"
							aria-label={`Remove secret ref ${index + 1}`}
							onClick={() => remove(index)}
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
					{ref.source === 'shared' ? (
						<div className="md:col-span-4">
							<Badge variant="warning">orchestrator-managed</Badge>
						</div>
					) : null}
				</div>
			))}
		</div>
	)
}

export function parseSecretRefs(raw: unknown): SecretRefDraft[] {
	if (!Array.isArray(raw)) return []
	return raw
		.map((item): SecretRefDraft | null => {
			if (!item || typeof item !== 'object') return null
			const r = item as Record<string, unknown>
			const source = typeof r.source === 'string' ? (r.source as SecretSource) : null
			if (source !== 'env' && source !== 'file' && source !== 'exec' && source !== 'shared')
				return null
			const name = typeof r.name === 'string' ? r.name : ''
			if (!name) return null
			return {
				name,
				source,
				key: source === 'shared' ? undefined : typeof r.key === 'string' ? r.key : '',
				description: typeof r.description === 'string' ? r.description : undefined,
			}
		})
		.filter((item): item is SecretRefDraft => item !== null)
}

export function serializeSecretRefs(refs: SecretRefDraft[]): Record<string, unknown>[] {
	return refs
		.filter((ref) => ref.name.trim())
		.map((ref) => {
			if (ref.source === 'shared') {
				return {
					name: ref.name,
					source: ref.source,
					...(ref.description ? { description: ref.description } : {}),
				}
			}
			return {
				name: ref.name,
				source: ref.source,
				key: ref.key ?? '',
				...(ref.description ? { description: ref.description } : {}),
			}
		})
}
