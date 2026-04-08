/**
 * Tests for conversation flow changes:
 * - SessionMessageService CRUD, queuing, consumption, clearing
 * - Session resume state (runtime_session_ref + preferred_worker_id)
 * - Query session_id binding and getByRunIdAnyStatus
 * - buildQueryInstructions: cold start, resume, sender_name
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { sessionMessages } from '../src/db/company-schema'
import { SessionService, QueryService, SessionMessageService } from '../src/services'
import { buildQueryInstructions } from '../src/services/queries'
import type { SessionMessageRow } from '../src/services/session-messages'
import { QueryRowSchema, SessionRowSchema, SessionMessageRowSchema } from '@questpie/autopilot-spec'

// ─── Setup ────────────────────────────────────────────────────────────────────

const dir = join(tmpdir(), `conv-flow-test-${Date.now()}`)
let dbResult: CompanyDbResult
let sessionSvc: SessionService
let querySvc: QueryService
let msgSvc: SessionMessageService

beforeAll(async () => {
	dbResult = await createCompanyDb(dir)
	sessionSvc = new SessionService(dbResult.db)
	querySvc = new QueryService(dbResult.db)
	msgSvc = new SessionMessageService(dbResult.db)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(dir, { recursive: true, force: true })
})

// Small sleep to ensure distinct created_at timestamps in SQLite
function tick(ms = 5): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

// ─── SessionMessageService ────────────────────────────────────────────────────

describe('SessionMessageService', () => {
	const SESSION_ID = 'sess-msg-test'

	test('create and list messages', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-msg',
		})

		const m1 = await msgSvc.create({ session_id: s.id, role: 'user', content: 'Hello' })
		await tick()
		const m2 = await msgSvc.create({ session_id: s.id, role: 'assistant', content: 'Hi there' })
		await tick()
		const m3 = await msgSvc.create({ session_id: s.id, role: 'system', content: 'System note' })

		const list = await msgSvc.listRecent(s.id)
		expect(list.length).toBe(3)
		expect(list[0].id).toBe(m1.id)
		expect(list[1].id).toBe(m2.id)
		expect(list[2].id).toBe(m3.id)
		expect(list[0].role).toBe('user')
		expect(list[1].role).toBe('assistant')
		expect(list[2].role).toBe('system')
	})

	test('listQueued returns only unconsumed user messages', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-queued',
		})

		// Unconsumed user message (query_id = null)
		const queued = await msgSvc.create({ session_id: s.id, role: 'user', content: 'queued msg' })
		// Consumed user message (query_id set)
		await msgSvc.create({ session_id: s.id, role: 'user', content: 'consumed msg', query_id: 'q-existing' })

		const result = await msgSvc.listQueued(s.id)
		expect(result.length).toBe(1)
		expect(result[0].id).toBe(queued.id)
		expect(result[0].content).toBe('queued msg')
	})

	test('markConsumed sets query_id', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-consume',
		})

		const msg = await msgSvc.create({ session_id: s.id, role: 'user', content: 'to consume' })
		expect(msg.query_id).toBeNull()

		await msgSvc.markConsumed([msg.id], 'q-consumed-1')

		const updated = await msgSvc.get(msg.id)
		expect(updated).toBeDefined()
		expect(updated!.query_id).toBe('q-consumed-1')
	})

	test('clearForSession removes all messages', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-clear',
		})

		await msgSvc.create({ session_id: s.id, role: 'user', content: 'msg1' })
		await msgSvc.create({ session_id: s.id, role: 'assistant', content: 'msg2' })

		const before = await msgSvc.listRecent(s.id)
		expect(before.length).toBe(2)

		await msgSvc.clearForSession(s.id)

		const after = await msgSvc.listRecent(s.id)
		expect(after.length).toBe(0)
	})

	test('updateContent modifies message in place', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-update',
		})

		const msg = await msgSvc.create({ session_id: s.id, role: 'assistant', content: 'original' })
		await msgSvc.updateContent(msg.id, 'updated content')

		const fetched = await msgSvc.get(msg.id)
		expect(fetched).toBeDefined()
		expect(fetched!.content).toBe('updated content')
	})

	test('listSystemSince filters by role and timestamp', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p1',
			external_conversation_id: 'conv-sys-since',
		})

		const sysT0 = await msgSvc.create({ session_id: s.id, role: 'system', content: 'old system' })
		const sinceTs = sysT0.created_at // We want messages strictly after this
		await tick()
		await msgSvc.create({ session_id: s.id, role: 'user', content: 'user msg' })
		await tick()
		const sysT2 = await msgSvc.create({ session_id: s.id, role: 'system', content: 'new system' })

		const result = await msgSvc.listSystemSince(s.id, sinceTs)
		// Should only return the system message created after sinceTs (gt, not gte)
		expect(result.length).toBe(1)
		expect(result[0].id).toBe(sysT2.id)
		expect(result[0].content).toBe('new system')
	})
})

// ─── Session resume state ────────────────────────────────────────────────────

describe('Session resume state', () => {
	test('updateResumeState stores ref and worker', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p-resume',
			external_conversation_id: 'conv-resume-1',
		})

		await sessionSvc.updateResumeState(s.id, 'claude-session-abc', 'worker-42')

		const updated = await sessionSvc.get(s.id)
		expect(updated).toBeDefined()
		expect(updated!.runtime_session_ref).toBe('claude-session-abc')
		expect(updated!.preferred_worker_id).toBe('worker-42')
	})

	test('updateResumeState with nulls clears state', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p-resume',
			external_conversation_id: 'conv-resume-2',
		})

		await sessionSvc.updateResumeState(s.id, 'ref-to-clear', 'worker-to-clear')
		const set = await sessionSvc.get(s.id)
		expect(set!.runtime_session_ref).toBe('ref-to-clear')

		await sessionSvc.updateResumeState(s.id, null, null)
		const cleared = await sessionSvc.get(s.id)
		expect(cleared).toBeDefined()
		expect(cleared!.runtime_session_ref).toBeNull()
		expect(cleared!.preferred_worker_id).toBeNull()
	})
})

// ─── Query session_id ────────────────────────────────────────────────────────

describe('Query session_id', () => {
	test('create query with session_id', async () => {
		const q = await querySvc.create({
			prompt: 'test prompt',
			agent_id: 'agent-1',
			allow_repo_mutation: false,
			session_id: 'sess-xyz',
			created_by: 'test-user',
		})

		expect(q.session_id).toBe('sess-xyz')

		const fetched = await querySvc.get(q.id)
		expect(fetched).toBeDefined()
		expect(fetched!.session_id).toBe('sess-xyz')
	})

	test('getByRunIdAnyStatus finds completed query', async () => {
		const q = await querySvc.create({
			prompt: 'will complete',
			agent_id: 'agent-1',
			allow_repo_mutation: false,
			created_by: 'test-user',
		})

		await querySvc.linkRun(q.id, 'run-complete-1')
		await querySvc.complete(q.id, { status: 'completed', summary: 'done' })

		// getByRunId filters by status=running, so should NOT find it
		const byRunId = await querySvc.getByRunId('run-complete-1')
		expect(byRunId).toBeUndefined()

		// getByRunIdAnyStatus ignores status, so should find it
		const byAny = await querySvc.getByRunIdAnyStatus('run-complete-1')
		expect(byAny).toBeDefined()
		expect(byAny!.id).toBe(q.id)
		expect(byAny!.status).toBe('completed')
	})
})

// ─── buildQueryInstructions ─────────────────────────────────────────────────

describe('buildQueryInstructions', () => {
	function makeMsg(overrides: Partial<SessionMessageRow> & { role: string; content: string }): SessionMessageRow {
		const now = new Date().toISOString()
		return {
			id: `smsg-test-${Math.random().toString(36).slice(2)}`,
			session_id: 'sess-test',
			role: overrides.role,
			content: overrides.content,
			query_id: overrides.query_id ?? null,
			external_message_id: overrides.external_message_id ?? null,
			metadata: overrides.metadata ?? '{}',
			created_at: overrides.created_at ?? now,
		}
	}

	test('cold start includes conversation history', () => {
		const msgs = [
			makeMsg({ role: 'user', content: 'Hello from user' }),
			makeMsg({ role: 'assistant', content: 'Hello back' }),
			makeMsg({ role: 'system', content: 'System event' }),
		]

		const result = buildQueryInstructions('current prompt', {
			sessionMessages: msgs,
			allowMutation: false,
			hasResume: false,
		})

		expect(result).toContain('## Conversation History')
		expect(result).toContain('Hello from user')
		expect(result).toContain('Hello back')
		expect(result).toContain('System event')
		expect(result).toContain('current prompt')
	})

	test('resume mode with system msgs includes notifications', () => {
		const msgs = [
			makeMsg({ role: 'system', content: 'PR merged notification' }),
			makeMsg({ role: 'system', content: 'Build passed' }),
		]

		const result = buildQueryInstructions('follow up', {
			sessionMessages: msgs,
			allowMutation: false,
			hasResume: true,
		})

		expect(result).toContain('## System Notifications')
		expect(result).toContain('PR merged notification')
		expect(result).toContain('Build passed')
		// Should NOT include full conversation history header
		expect(result).not.toContain('## Conversation History')
	})

	test('resume mode without system msgs is minimal', () => {
		const result = buildQueryInstructions('simple resume', {
			sessionMessages: [],
			allowMutation: false,
			hasResume: true,
		})

		expect(result).not.toContain('## Conversation History')
		expect(result).not.toContain('## System Notifications')
		expect(result).toContain('simple resume')
	})

	test('sender_name renders as [user:Name]', () => {
		const msgs = [
			makeMsg({ role: 'user', content: 'Ahoj', metadata: JSON.stringify({ sender_name: 'Jan' }) }),
		]

		const result = buildQueryInstructions('reply', {
			sessionMessages: msgs,
			allowMutation: false,
			hasResume: false,
		})

		expect(result).toContain('[user:Jan]')
		expect(result).toContain('Ahoj')
	})

})

// ─── listRecent returns latest N in chronological order ─────────────────────

describe('listRecent returns latest N in chronological order', () => {
	let listRecentSessionId: string

	beforeAll(async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p-list-recent',
			external_conversation_id: 'conv-list-recent',
		})
		listRecentSessionId = s.id
	})

	test('listRecent returns latest N messages in chronological order', async () => {
		for (let i = 1; i <= 25; i++) {
			await msgSvc.create({
				session_id: listRecentSessionId,
				role: 'user',
				content: `msg-${i}`,
			})
			// Small delay for distinct timestamps
			await new Promise((r) => setTimeout(r, 5))
		}

		const recent = await msgSvc.listRecent(listRecentSessionId, 20)
		expect(recent.length).toBe(20)
		// First should be msg-6, last should be msg-25
		expect(recent[0].content).toBe('msg-6')
		expect(recent[19].content).toBe('msg-25')
		// Verify chronological order
		for (let i = 1; i < recent.length; i++) {
			expect(recent[i].created_at >= recent[i - 1].created_at).toBe(true)
		}
	})
})

// ─── Session close prevents bridge delivery ─────────────────────────────────

describe('Session close prevents bridge delivery', () => {
	const CLOSE_PROVIDER = 'p-close-test'
	const CLOSE_CONV = 'conv-close-test'

	test('close sets status to closed and findByExternal excludes it', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: CLOSE_PROVIDER,
			external_conversation_id: CLOSE_CONV,
		})
		expect(s.status).toBe('active')

		const closed = await sessionSvc.close(s.id)
		expect(closed).toBeDefined()
		expect(closed!.status).toBe('closed')

		// findByExternal should not return closed sessions
		const found = await sessionSvc.findByExternal(CLOSE_PROVIDER, CLOSE_CONV)
		expect(found).toBeUndefined()
	})

	test('findOrCreate after close creates a new session', async () => {
		// The previous test closed the session for CLOSE_PROVIDER/CLOSE_CONV
		const fresh = await sessionSvc.findOrCreate({
			provider_id: CLOSE_PROVIDER,
			external_conversation_id: CLOSE_CONV,
		})
		expect(fresh.status).toBe('active')

		// Verify it has a different ID than any closed session
		const allSessions = await sessionSvc.list({ provider_id: CLOSE_PROVIDER })
		const closedSessions = allSessions.filter((s) => s.status === 'closed')
		for (const cs of closedSessions) {
			expect(fresh.id).not.toBe(cs.id)
		}
	})
})

// ─── buildQueryInstructions without carryoverSummary ────────────────────────

describe('buildQueryInstructions without carryoverSummary', () => {
	test('no PRIOR_QUERY_CONTEXT when called without carryoverSummary', () => {
		const result = buildQueryInstructions('test', {
			allowMutation: false,
			hasResume: false,
		})

		expect(result).not.toContain('PRIOR_QUERY_CONTEXT')
		expect(result).toContain('test')
	})

	test('works with empty sessionMessages and no legacy fields', () => {
		const result = buildQueryInstructions('hello', {
			sessionMessages: [],
			allowMutation: false,
			hasResume: false,
		})

		expect(result).not.toContain('## Conversation History')
		expect(result).not.toContain('PRIOR_QUERY_CONTEXT')
		expect(result).toContain('hello')
		expect(result).toContain('QUERY MODE (read-only)')
	})
})

// ─── Spec schema validation ────────────────────────────────────────────────

describe('Spec schema validation', () => {
	test('QueryRowSchema accepts session_id', () => {
		const result = QueryRowSchema.safeParse({
			id: 'q-1',
			prompt: 'test',
			agent_id: 'a-1',
			run_id: null,
			status: 'pending',
			allow_repo_mutation: false,
			mutated_repo: false,
			summary: null,
			runtime_session_ref: null,
			created_by: 'user-1',
			created_at: new Date().toISOString(),
			ended_at: null,
			metadata: '{}',
			session_id: 'sess-1',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.session_id).toBe('sess-1')
		}
	})

	test('QueryRowSchema accepts null session_id', () => {
		const result = QueryRowSchema.safeParse({
			id: 'q-2',
			prompt: 'test',
			agent_id: 'a-1',
			run_id: null,
			status: 'pending',
			allow_repo_mutation: false,
			mutated_repo: false,
			summary: null,
			runtime_session_ref: null,
			created_by: 'user-1',
			created_at: new Date().toISOString(),
			ended_at: null,
			metadata: '{}',
			session_id: null,
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.session_id).toBeNull()
		}
	})

	test('SessionRowSchema accepts resume fields', () => {
		const result = SessionRowSchema.safeParse({
			id: 's-1',
			provider_id: 'p-1',
			external_conversation_id: 'conv-1',
			external_thread_id: null,
			mode: 'query',
			task_id: null,
			status: 'active',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			metadata: '{}',
			runtime_session_ref: 'claude-abc',
			preferred_worker_id: 'w-1',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.runtime_session_ref).toBe('claude-abc')
			expect(result.data.preferred_worker_id).toBe('w-1')
		}
	})

	test('SessionMessageRowSchema validates message', () => {
		const result = SessionMessageRowSchema.safeParse({
			id: 'smsg-1',
			session_id: 'sess-1',
			role: 'user',
			content: 'hello',
			query_id: null,
			external_message_id: 'msg-123',
			metadata: '{}',
			created_at: new Date().toISOString(),
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.role).toBe('user')
			expect(result.data.content).toBe('hello')
			expect(result.data.external_message_id).toBe('msg-123')
		}
	})

	test('SessionMessageRowSchema rejects invalid role', () => {
		const result = SessionMessageRowSchema.safeParse({
			id: 'smsg-bad',
			session_id: 'sess-1',
			role: 'invalid',
			content: 'hello',
			query_id: null,
			external_message_id: null,
			metadata: '{}',
			created_at: new Date().toISOString(),
		})
		expect(result.success).toBe(false)
	})
})

// ─── Deterministic ordering with same-millisecond messages ─────────────────

describe('Deterministic ordering with same-millisecond messages', () => {
	let orderSessionId: string

	beforeAll(async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p-order-test',
			external_conversation_id: 'conv-order-test',
		})
		orderSessionId = s.id
	})

	test('listRecent preserves insertion order for identical timestamps', async () => {
		const fixedTime = new Date().toISOString()
		for (let i = 1; i <= 5; i++) {
			await dbResult.db.insert(sessionMessages).values({
				id: `smsg-order-${i}`,
				session_id: orderSessionId,
				role: 'user',
				content: `order-${i}`,
				query_id: null,
				external_message_id: null,
				metadata: '{}',
				created_at: fixedTime,
			})
		}

		const recent = await msgSvc.listRecent(orderSessionId, 5)
		expect(recent.length).toBe(5)
		expect(recent[0].content).toBe('order-1')
		expect(recent[1].content).toBe('order-2')
		expect(recent[2].content).toBe('order-3')
		expect(recent[3].content).toBe('order-4')
		expect(recent[4].content).toBe('order-5')
	})
})

// ─── markConsumed ordering safety ──────────────────────────────────────────

describe('markConsumed ordering safety', () => {
	test('markConsumed removes message from listQueued and sets query_id', async () => {
		const s = await sessionSvc.findOrCreate({
			provider_id: 'p-consume-order',
			external_conversation_id: 'conv-consume-order',
		})

		// Create a query for this session
		const q = await querySvc.create({
			prompt: 'consume test',
			agent_id: 'agent-1',
			allow_repo_mutation: false,
			session_id: s.id,
			created_by: 'test-user',
		})

		// Create an unconsumed user message
		const msg = await msgSvc.create({
			session_id: s.id,
			role: 'user',
			content: 'pending message',
		})

		// Verify the message is in listQueued
		const queuedBefore = await msgSvc.listQueued(s.id)
		const found = queuedBefore.find((m) => m.id === msg.id)
		expect(found).toBeDefined()

		// Consume it
		await msgSvc.markConsumed([msg.id], q.id)

		// Verify the message is no longer in listQueued
		const queuedAfter = await msgSvc.listQueued(s.id)
		const notFound = queuedAfter.find((m) => m.id === msg.id)
		expect(notFound).toBeUndefined()

		// Verify get shows query_id set
		const updated = await msgSvc.get(msg.id)
		expect(updated).toBeDefined()
		expect(updated!.query_id).toBe(q.id)
	})
})
