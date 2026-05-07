/**
 * Provider setup wizard.
 *
 * Providers are the extension point for external channels (notifications,
 * intent intake, conversations). The form captures the structured fields
 * (id, name, kind, handler, capabilities, events, secret refs) and falls
 * back to a single JSON textarea for the freeform `config` payload —
 * provider-specific config can vary too widely for a single form.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SurfaceSection } from '@/components/ui/surface-section'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
	parseSecretRefs,
	type SecretRefDraft,
	SecretRefEditor,
	serializeSecretRefs,
} from './secret-ref-editor'

type ProviderKind = 'notification_channel' | 'intent_channel' | 'conversation_channel'

interface EventFilterDraft {
	types: string[]
	statuses?: string[]
}

interface ProviderDraft {
	id: string
	name: string
	kind: ProviderKind
	handler: string
	description: string
	capabilities: string[]
	events: EventFilterDraft[]
	secret_refs: SecretRefDraft[]
	config_json: string
	config_error: string | null
}

interface ProviderWizardProps {
	value: string
	onChange: (next: string) => void
	draftId: string
	onDraftIdChange: (next: string) => void
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}
function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === 'string')
}

function parseDraft(value: string, fallbackId: string): ProviderDraft {
	const empty: ProviderDraft = {
		id: fallbackId,
		name: '',
		kind: 'conversation_channel',
		handler: 'handlers/',
		description: '',
		capabilities: [],
		events: [],
		secret_refs: [],
		config_json: '{}',
		config_error: null,
	}
	if (!value.trim()) return empty
	try {
		const raw = JSON.parse(value) as Record<string, unknown>
		const kind =
			raw.kind === 'notification_channel' ||
			raw.kind === 'intent_channel' ||
			raw.kind === 'conversation_channel'
				? raw.kind
				: 'conversation_channel'

		const capabilities = Array.isArray(raw.capabilities)
			? raw.capabilities
					.map((c) => (c && typeof c === 'object' ? asString((c as Record<string, unknown>).op) : null))
					.filter((c): c is string => Boolean(c))
			: []

		const events = Array.isArray(raw.events)
			? raw.events
					.map((e) => {
						if (!e || typeof e !== 'object') return null
						const r = e as Record<string, unknown>
						const types = asStringArray(r.types)
						if (types.length === 0) return null
						const statuses = asStringArray(r.statuses)
						return statuses.length > 0 ? { types, statuses } : { types }
					})
					.filter((e): e is EventFilterDraft => e !== null)
			: []

		const config = raw.config && typeof raw.config === 'object' ? raw.config : {}
		return {
			id: asString(raw.id) ?? fallbackId,
			name: asString(raw.name) ?? '',
			kind,
			handler: asString(raw.handler) ?? 'handlers/',
			description: asString(raw.description) ?? '',
			capabilities,
			events,
			secret_refs: parseSecretRefs(raw.secret_refs),
			config_json: JSON.stringify(config, null, 2),
			config_error: null,
		}
	} catch {
		return empty
	}
}

function serializeDraft(draft: ProviderDraft): string {
	let configValue: unknown = {}
	try {
		configValue = JSON.parse(draft.config_json || '{}')
	} catch {
		configValue = {}
	}
	return JSON.stringify(
		{
			id: draft.id,
			name: draft.name,
			kind: draft.kind,
			handler: draft.handler,
			description: draft.description,
			capabilities: draft.capabilities.map((op) => ({ op })),
			events: draft.events,
			secret_refs: serializeSecretRefs(draft.secret_refs),
			config: configValue,
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

export function ProviderSetupWizard({
	value,
	onChange,
	draftId,
	onDraftIdChange,
}: ProviderWizardProps) {
	const parsed = useMemo(() => parseDraft(value, draftId), [draftId, value])
	const [draft, setDraft] = useState<ProviderDraft>(parsed)

	useEffect(() => {
		setDraft(parsed)
	}, [parsed])

	function applyChange(next: ProviderDraft) {
		setDraft(next)
		onDraftIdChange(next.id)
		onChange(serializeDraft(next))
	}

	function update(patch: Partial<ProviderDraft>) {
		applyChange({ ...draft, ...patch })
	}

	function updateName(name: string) {
		const id = draft.id ? draft.id : toSlug(name)
		applyChange({ ...draft, name, id })
	}

	function updateConfigJson(text: string) {
		let error: string | null = null
		try {
			JSON.parse(text || '{}')
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid JSON'
		}
		applyChange({ ...draft, config_json: text, config_error: error })
	}

	function addEventFilter() {
		update({ events: [...draft.events, { types: [] }] })
	}

	function updateEventFilter(index: number, patch: Partial<EventFilterDraft>) {
		const next = [...draft.events]
		next[index] = { ...next[index]!, ...patch }
		update({ events: next })
	}

	function removeEventFilter(index: number) {
		update({ events: draft.events.filter((_, i) => i !== index) })
	}

	const handlerInvalid = !draft.handler.startsWith('handlers/') || draft.handler.includes('..')

	return (
		<div className="space-y-4">
			<SurfaceSection
				title="Provider"
				description="Providers are scripts under handlers/ that receive normalized envelopes for notify/ingest/conversation operations."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-2">
					<div className="space-y-1">
						<Label>Provider ID</Label>
						<Input
							aria-label="Provider ID"
							value={draft.id}
							onChange={(e) => update({ id: toSlug(e.target.value) })}
							placeholder="slack-ops"
						/>
					</div>
					<div className="space-y-1">
						<Label>Display name</Label>
						<Input
							aria-label="Provider name"
							value={draft.name}
							onChange={(e) => updateName(e.target.value)}
							placeholder="Slack ops"
						/>
					</div>
					<div className="space-y-1">
						<Label>Kind</Label>
						<Select
							aria-label="Provider kind"
							value={draft.kind}
							onChange={(e) => update({ kind: e.target.value as ProviderKind })}
						>
							<option value="conversation_channel">Conversation channel</option>
							<option value="notification_channel">Notification channel</option>
							<option value="intent_channel">Intent channel</option>
						</Select>
					</div>
					<div className="space-y-1">
						<Label>Handler script (must start with handlers/)</Label>
						<Input
							aria-label="Handler path"
							value={draft.handler}
							onChange={(e) => update({ handler: e.target.value })}
							placeholder="handlers/slack-ops.ts"
						/>
						{handlerInvalid ? (
							<p className="text-xs text-destructive">
								Handler must start with handlers/ and must not contain "..".
							</p>
						) : null}
					</div>
					<div className="md:col-span-2 space-y-1">
						<Label>Description</Label>
						<Textarea
							aria-label="Provider description"
							value={draft.description}
							onChange={(e) => update({ description: e.target.value })}
							placeholder="Where it dispatches events and what payload shape the handler expects."
							className="min-h-20 resize-y"
						/>
					</div>
					<div className="md:col-span-2 space-y-1">
						<Label>Operations / capabilities (comma separated)</Label>
						<Input
							aria-label="Provider capabilities"
							value={draft.capabilities.join(', ')}
							onChange={(e) => update({ capabilities: parseCsv(e.target.value) })}
							placeholder="notify.send, conversation.ingest, intent.ingest"
						/>
						{draft.capabilities.length === 0 ? (
							<p className="text-xs text-amber-500">
								At least one capability operation is required.
							</p>
						) : null}
					</div>
				</div>
			</SurfaceSection>

			<SurfaceSection
				title="Event filters"
				description="Which orchestrator events trigger this provider. Leave empty for outbound-only providers."
				action={
					<Button type="button" size="sm" variant="outline" onClick={addEventFilter}>
						<Plus className="size-3.5" />
						Add filter
					</Button>
				}
				contentClassName="space-y-2"
			>
				{draft.events.length === 0 ? (
					<p className="text-sm text-muted-foreground">No event filters configured.</p>
				) : (
					draft.events.map((filter, index) => (
						<div
							key={index}
							className="grid gap-2 rounded-lg border border-border/60 bg-card/30 p-3 md:grid-cols-[1fr_1fr_auto]"
						>
							<div className="space-y-1">
								<Label>Event types</Label>
								<Input
									aria-label={`Event types ${index + 1}`}
									value={filter.types.join(', ')}
									onChange={(e) =>
										updateEventFilter(index, { types: parseCsv(e.target.value) })
									}
									placeholder="run_completed, task_changed"
								/>
							</div>
							<div className="space-y-1">
								<Label>Statuses (optional)</Label>
								<Input
									aria-label={`Event statuses ${index + 1}`}
									value={(filter.statuses ?? []).join(', ')}
									onChange={(e) =>
										updateEventFilter(index, {
											statuses: e.target.value ? parseCsv(e.target.value) : undefined,
										})
									}
									placeholder="failed, blocked"
								/>
							</div>
							<div className="flex items-end">
								<Button
									type="button"
									size="icon"
									variant="ghost"
									aria-label={`Remove event filter ${index + 1}`}
									onClick={() => removeEventFilter(index)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						</div>
					))
				)}
			</SurfaceSection>

			<SurfaceSection
				title="Secrets"
				description="Refs the handler can resolve at run time."
				contentClassName="space-y-2"
			>
				<SecretRefEditor
					values={draft.secret_refs}
					onChange={(next) => update({ secret_refs: next })}
				/>
			</SurfaceSection>

			<SurfaceSection
				title="Provider config (JSON)"
				description="Static handler config — JSON-safe, non-secret. Provider-specific shape; the form does not enforce a schema here."
				action={
					draft.config_error ? <Badge variant="destructive">JSON invalid</Badge> : null
				}
				contentClassName="space-y-1"
			>
				<Textarea
					aria-label="Provider config JSON"
					value={draft.config_json}
					onChange={(e) => updateConfigJson(e.target.value)}
					className="min-h-32 resize-y font-mono text-xs"
					placeholder='{ "channel": "#ops" }'
				/>
				{draft.config_error ? (
					<p className="text-xs text-destructive">{draft.config_error}</p>
				) : null}
			</SurfaceSection>
		</div>
	)
}
