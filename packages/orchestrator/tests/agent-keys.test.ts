import { describe, test, expect } from 'bun:test'
import { ensureAgentKeys, verifyAgentKey } from '../src/auth/agent-keys'
import { createTestCompany } from './helpers'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

describe('agent keys', () => {
	test('generates keys for all agents', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })

			const agents = [
				{ id: 'ceo' },
				{ id: 'sam' },
				{ id: 'alex' },
			]

			const keyMap = await ensureAgentKeys(root, agents)

			expect(keyMap.size).toBe(3)
			expect(keyMap.has('ceo')).toBe(true)
			expect(keyMap.has('sam')).toBe(true)
			expect(keyMap.has('alex')).toBe(true)

			// Keys should start with ap_{agentId}_
			expect(keyMap.get('ceo')!.startsWith('ap_ceo_')).toBe(true)
			expect(keyMap.get('sam')!.startsWith('ap_sam_')).toBe(true)
		} finally {
			await cleanup()
		}
	})

	test('verifies valid agent key', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })

			const agents = [{ id: 'ceo' }]
			const keyMap = await ensureAgentKeys(root, agents)
			const rawKey = keyMap.get('ceo')!

			const result = await verifyAgentKey(root, rawKey)
			expect(result).not.toBeNull()
			expect(result!.agentId).toBe('ceo')
		} finally {
			await cleanup()
		}
	})

	test('rejects invalid agent key', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })

			const agents = [{ id: 'ceo' }]
			await ensureAgentKeys(root, agents)

			const result = await verifyAgentKey(root, 'ap_ceo_invalid_key_here')
			expect(result).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('returns null when no keys file exists', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			const result = await verifyAgentKey(root, 'ap_ceo_some_key')
			expect(result).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('ensureAgentKeys is idempotent — returns same keys on second call', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })
			const agents = [{ id: 'dev' }]
			const first = await ensureAgentKeys(root, agents)
			const second = await ensureAgentKeys(root, agents)
			expect(first.get('dev')).toBe(second.get('dev'))
		} finally {
			await cleanup()
		}
	})

	test('each agent gets a unique key', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })
			const agents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
			const keys = await ensureAgentKeys(root, agents)
			const values = [...keys.values()]
			const unique = new Set(values)
			expect(unique.size).toBe(3)
		} finally {
			await cleanup()
		}
	})

	test('key for agent A cannot verify as agent B', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })
			const agents = [{ id: 'dev' }, { id: 'ops' }]
			const keys = await ensureAgentKeys(root, agents)
			const devKey = keys.get('dev')!

			const result = await verifyAgentKey(root, devKey)
			expect(result!.agentId).toBe('dev')
			expect(result!.agentId).not.toBe('ops')
		} finally {
			await cleanup()
		}
	})

	test('returns null for completely malformed key', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })
			await ensureAgentKeys(root, [{ id: 'dev' }])

			expect(await verifyAgentKey(root, '')).toBeNull()
			expect(await verifyAgentKey(root, 'not-a-valid-format')).toBeNull()
			expect(await verifyAgentKey(root, 'ap_')).toBeNull()
		} finally {
			await cleanup()
		}
	})

	test('key format is ap_{agentId}_{random}', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, '.auth'), { recursive: true })
			const keys = await ensureAgentKeys(root, [{ id: 'my-agent' }])
			const key = keys.get('my-agent')!
			expect(key).toMatch(/^ap_my-agent_.+$/)
		} finally {
			await cleanup()
		}
	})
})
