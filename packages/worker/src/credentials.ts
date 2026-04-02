/**
 * Worker credential storage — persists durable machine identity locally.
 *
 * Stored at: ~/.autopilot/credentials/<url-hash>.json
 * Scoped by orchestrator URL so one machine can connect to multiple orchestrators.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface StoredCredential {
  orchestratorUrl: string
  workerId: string
  machineSecret: string
  enrolledAt: string
}

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
    const data = JSON.parse(readFileSync(path, 'utf-8')) as StoredCredential
    if (data.orchestratorUrl !== orchestratorUrl) return null
    return data
  } catch {
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
