/**
 * Tests for run steering (mid-run user messages).
 *
 * Covers:
 * - SteerService CRUD
 * - Claim semantics (pending -> delivered)
 * - Schema validation
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RunSteerRequestSchema, RunSteerSchema } from '@questpie/autopilot-spec'
import { createCompanyDb, type CompanyDbResult } from '../src/db'
import { SteerService } from '../src/services/steers'

describe('SteerService', () => {
	let companyRoot: string
	let dbResult: CompanyDbResult
	let steerService: SteerService

	beforeAll(async () => {
		companyRoot = join(tmpdir(), `steer-test-${Date.now()}`)
		await mkdir(companyRoot, { recursive: true })
		dbResult = await createCompanyDb(companyRoot)
		steerService = new SteerService(dbResult.db)
	})

	afterAll(async () => {
		dbResult.raw.close()
		await rm(companyRoot, { recursive: true, force: true })
	})

	test('RunSteerRequestSchema validates correctly', () => {
		const valid = RunSteerRequestSchema.safeParse({
			message: 'Focus on pricing',
		})
		expect(valid.success).toBe(true)

		const invalid = RunSteerRequestSchema.safeParse({
			message: '',
		})
		expect(invalid.success).toBe(false)
	})

	test('RunSteerSchema validates steer row shape', () => {
		const valid = RunSteerSchema.safeParse({
			id: 'steer-1',
			run_id: 'run-1',
			message: 'Focus on pricing',
			status: 'pending',
			created_by: 'user:1',
			created_at: new Date().toISOString(),
			delivered_at: null,
		})
		expect(valid.success).toBe(true)
	})

	test('create and get steer', async () => {
		const steer = await steerService.create({
			run_id: 'run-test-1',
			message: 'Focus on pricing section',
			created_by: 'user:test',
		})

		expect(steer.id).toMatch(/^steer-/)
		expect(steer.run_id).toBe('run-test-1')
		expect(steer.message).toBe('Focus on pricing section')
		expect(steer.status).toBe('pending')
		expect(steer.created_by).toBe('user:test')
		expect(steer.delivered_at).toBeNull()

		const fetched = await steerService.get(steer.id)
		expect(fetched).toBeDefined()
		expect(fetched!.id).toBe(steer.id)
	})

	test('claimPending returns pending steers and marks them delivered', async () => {
		// Create multiple steers for the same run
		await steerService.create({
			run_id: 'run-claim-test',
			message: 'First steer',
			created_by: 'user:1',
		})
		await steerService.create({
			run_id: 'run-claim-test',
			message: 'Second steer',
			created_by: 'user:1',
		})

		// Claim pending steers
		const claimed = await steerService.claimPending('run-claim-test')
		expect(claimed.length).toBe(2)
		expect(claimed[0]!.message).toBe('First steer')
		expect(claimed[1]!.message).toBe('Second steer')

		// Claiming again should return empty
		const claimedAgain = await steerService.claimPending('run-claim-test')
		expect(claimedAgain.length).toBe(0)

		// Verify steers are marked as delivered
		const all = await steerService.listForRun('run-claim-test')
		expect(all.every((s) => s.status === 'delivered')).toBe(true)
		expect(all.every((s) => s.delivered_at !== null)).toBe(true)
	})

	test('claimPending returns empty for nonexistent run', async () => {
		const claimed = await steerService.claimPending('run-nonexistent')
		expect(claimed.length).toBe(0)
	})

	test('listForRun returns all steers for a run', async () => {
		await steerService.create({
			run_id: 'run-list-test',
			message: 'List steer 1',
			created_by: 'user:1',
		})
		await steerService.create({
			run_id: 'run-list-test',
			message: 'List steer 2',
			created_by: 'user:1',
		})

		const all = await steerService.listForRun('run-list-test')
		expect(all.length).toBe(2)
	})
})
