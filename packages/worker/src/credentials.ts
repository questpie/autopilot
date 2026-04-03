/**
 * Worker credential storage — persists durable machine identity locally.
 *
 * Stored at: ~/.autopilot/credentials/<url-hash>.json
 * Scoped by orchestrator URL so one machine can connect to multiple orchestrators.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'

const StoredCredentialSchema = z.object({
  orchestratorUrl: z.string(),
  workerId: z.string(),
  machineSecret: z.string(),
  enrolledAt: z.string(),
})

export type StoredCredential = z.infer<typeof StoredCredentialSchema>

const CREDS_DIR = join(homedir(), '.autopilot', 'credentials')

function urlHash(url: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(url)
  return hasher.digest('hex').slice(0, 16)
}

function credPath(orchestratorUrl: string): string {
  return join(CREDS_DIR, `${urlHash(orchestratorUrl)}.json`)
}

export function loadCredential(orchestratorUrl: string): StoredCredential | null {
  const path = credPath(orchestratorUrl)
  if (!existsSync(path)) return null
  try {
    const parsed = StoredCredentialSchema.safeParse(JSON.parse(readFileSync(path, 'utf-8')))
    if (!parsed.success) {
      console.warn(`[credentials] corrupt credential file at ${path}:`, parsed.error.message)
      return null
    }
    if (parsed.data.orchestratorUrl !== orchestratorUrl) return null
    return parsed.data
  } catch (err) {
    console.warn(`[credentials] failed to read ${path}:`, (err as Error).message)
    return null
  }
}

export function saveCredential(cred: StoredCredential): void {
  mkdirSync(CREDS_DIR, { recursive: true })
  const path = credPath(cred.orchestratorUrl)
  writeFileSync(path, JSON.stringify(cred, null, '\t'), 'utf-8')
  chmodSync(path, 0o600)
}

export function clearCredential(orchestratorUrl: string): void {
  const path = credPath(orchestratorUrl)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}
