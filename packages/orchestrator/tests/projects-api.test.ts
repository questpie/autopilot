import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import type { AppEnv, Services } from '../src/api/app'
import { projectsRoute } from '../src/api/routes/projects'
import type { Actor } from '../src/auth/types'
import { type CompanyDbResult, createCompanyDb } from '../src/db'
import { ProjectService } from '../src/services/projects'

let testDir: string
let dbResult: CompanyDbResult
let projectService: ProjectService
let app: Hono<AppEnv>

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-projects-api-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	projectService = new ProjectService(dbResult.db)

	app = new Hono<AppEnv>()
	app.use('*', async (c, next) => {
		c.set('services', { projectService } as unknown as Services)
		c.set('actor', { type: 'user', id: 'test-user' } as Actor)
		await next()
	})
	app.route('/api/projects', projectsRoute)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

function req(method: string, path: string, body?: unknown) {
	const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
	if (body) init.body = JSON.stringify(body)
	return app.request(`http://localhost/api/projects${path}`, init)
}

describe('projects API', () => {
	test('registers and lists a project', async () => {
		const res = await req('POST', '', {
			name: 'questpie-autopilot',
			path: '/tmp/questpie-autopilot',
			git_remote: 'git@github.com:questpie/autopilot.git',
			default_branch: 'main',
		})
		expect(res.status).toBe(200)
		const project = (await res.json()) as { id: string; name: string; path: string }
		expect(project.name).toBe('questpie-autopilot')
		expect(project.path).toBe('/tmp/questpie-autopilot')

		const listRes = await req('GET', '')
		expect(listRes.status).toBe(200)
		const list = (await listRes.json()) as Array<{ id: string; path: string }>
		expect(list.some((item) => item.id === project.id)).toBe(true)
	})

	test('re-registering the same path updates existing project', async () => {
		const first = await req('POST', '', {
			name: 'initial',
			path: '/tmp/re-register-me',
			default_branch: 'main',
		})
		const firstProject = (await first.json()) as { id: string }

		const second = await req('POST', '', {
			name: 'updated',
			path: '/tmp/re-register-me',
			default_branch: 'develop',
		})
		expect(second.status).toBe(200)
		const secondProject = (await second.json()) as {
			id: string
			name: string
			default_branch: string | null
		}

		expect(secondProject.id).toBe(firstProject.id)
		expect(secondProject.name).toBe('updated')
		expect(secondProject.default_branch).toBe('develop')
	})

	test('deletes a project', async () => {
		const created = await req('POST', '', {
			name: 'delete-me',
			path: '/tmp/delete-me',
		})
		const project = (await created.json()) as { id: string }

		const del = await req('DELETE', `/${project.id}`)
		expect(del.status).toBe(200)

		const getRes = await req('GET', `/${project.id}`)
		expect(getRes.status).toBe(404)
	})
})
