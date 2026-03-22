import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function createTestCompany(): Promise<{
	root: string
	cleanup: () => Promise<void>
}> {
	const root = await Bun.$.cwd(tmpdir())`mktemp -d`.text()
	const base = root.trim()

	const dirs = [
		'tasks/backlog',
		'tasks/active',
		'tasks/review',
		'tasks/blocked',
		'tasks/done',
		'comms/channels/general',
		'comms/channels/dev',
		'comms/direct',
		'dashboard/pins',
		'logs/activity',
		'logs/sessions',
		'team',
		'team/workflows',
		'context/memory',
		'context/indexes',
	]

	for (const dir of dirs) {
		await mkdir(join(base, dir), { recursive: true })
	}

	return {
		root: base,
		cleanup: () => rm(base, { recursive: true, force: true }),
	}
}
