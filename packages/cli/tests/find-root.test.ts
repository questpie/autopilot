import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findCompanyRoot } from '../src/utils/find-root'

describe('findCompanyRoot', () => {
	let tempDir: string

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'autopilot-test-'))
	})

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true })
	})

	it('finds .autopilot/company.yaml in the given directory', async () => {
		await mkdir(join(tempDir, '.autopilot'), { recursive: true })
		await writeFile(join(tempDir, '.autopilot', 'company.yaml'), 'name: test')
		const root = await findCompanyRoot(tempDir)
		expect(root).toBe(tempDir)
	})

	it('finds .autopilot/company.yaml in a parent directory', async () => {
		await mkdir(join(tempDir, '.autopilot'), { recursive: true })
		await writeFile(join(tempDir, '.autopilot', 'company.yaml'), 'name: test')
		const subDir = join(tempDir, 'sub', 'nested')
		await mkdir(subDir, { recursive: true })
		const root = await findCompanyRoot(subDir)
		expect(root).toBe(tempDir)
	})

	it('throws when company.yaml is not found', async () => {
		const isolatedDir = await mkdtemp(join(tmpdir(), 'autopilot-no-company-'))
		try {
			await expect(findCompanyRoot(isolatedDir)).rejects.toThrow('Could not find .autopilot/company.yaml')
		} finally {
			await rm(isolatedDir, { recursive: true, force: true })
		}
	})
})
