/**
 * EnrollmentService — join token lifecycle + worker machine identity.
 *
 * Flow:
 * 1. Admin creates a short-lived join token via createToken()
 * 2. Worker enrolls via enroll(tokenSecret, workerInfo)
 *    - validates token (exists, not expired, not used)
 *    - creates worker record with hashed machine secret
 *    - marks token as consumed
 *    - returns worker_id + plaintext machine_secret (only time it's visible)
 * 3. Worker uses machine_secret on all subsequent API calls
 * 4. validateMachineSecret(workerId, secret) checks on every request
 */

import { eq } from 'drizzle-orm'
import { joinTokens, workers } from '../db/company-schema'
import type { CompanyDb } from '../db'

export type JoinTokenRow = typeof joinTokens.$inferSelect

/** SHA-256 hash a string. Returns hex. */
function hashSecret(secret: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(secret)
  return hasher.digest('hex')
}

/** Generate a cryptographically random token string. */
function generateSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

export class EnrollmentService {
  constructor(private db: CompanyDb) {}

  // ─── Join tokens ──────────────────────────────────────────────────

  /** Create a new join token. Returns the plaintext secret (shown once). */
  async createToken(input: {
    created_by: string
    description?: string
    ttl_seconds?: number
  }): Promise<{ token_id: string; secret: string; expires_at: string }> {
    const ttl = input.ttl_seconds ?? 3600
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString()

    const secret = generateSecret()
    const tokenId = `jt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    await this.db.insert(joinTokens).values({
      id: tokenId,
      secret_hash: hashSecret(secret),
      description: input.description,
      created_by: input.created_by,
      created_at: now.toISOString(),
      expires_at: expiresAt,
    })

    return { token_id: tokenId, secret, expires_at: expiresAt }
  }

  /** Get a token by ID. */
  async getToken(id: string): Promise<JoinTokenRow | undefined> {
    return this.db.select().from(joinTokens).where(eq(joinTokens.id, id)).get()
  }

  /** List all tokens (for admin visibility). */
  async listTokens(): Promise<JoinTokenRow[]> {
    return this.db.select().from(joinTokens).all()
  }

  // ─── Enrollment ───────────────────────────────────────────────────

  /**
   * Enroll a worker using a join token.
   * Returns the durable worker_id + plaintext machine_secret.
   * Throws on invalid/expired/used token.
   */
  async enroll(input: {
    token: string
    name: string
    device_id: string
    capabilities?: string
  }): Promise<{ worker_id: string; machine_secret: string }> {
    const secretHash = hashSecret(input.token)

    // Find token by hash
    const token = await this.db
      .select()
      .from(joinTokens)
      .where(eq(joinTokens.secret_hash, secretHash))
      .get()

    if (!token) {
      throw new EnrollmentError('Invalid join token')
    }

    if (token.used_at) {
      throw new EnrollmentError('Join token already used')
    }

    if (new Date(token.expires_at) < new Date()) {
      throw new EnrollmentError('Join token expired')
    }

    // Generate durable machine credential
    const machineSecret = generateSecret()
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    // Create worker with machine secret
    await this.db.insert(workers).values({
      id: workerId,
      device_id: input.device_id,
      name: input.name,
      status: 'online',
      capabilities: input.capabilities ?? '[]',
      registered_at: now,
      last_heartbeat: now,
      machine_secret_hash: hashSecret(machineSecret),
    })

    // Mark token as consumed
    await this.db
      .update(joinTokens)
      .set({ used_at: now, used_by_worker_id: workerId })
      .where(eq(joinTokens.id, token.id))

    return { worker_id: workerId, machine_secret: machineSecret }
  }

  // ─── Machine auth ─────────────────────────────────────────────────

  /**
   * Validate a machine secret for a worker.
   * Returns the worker ID if valid, null otherwise.
   */
  async validateMachineSecret(secret: string): Promise<string | null> {
    const secretHash = hashSecret(secret)
    const worker = await this.db
      .select()
      .from(workers)
      .where(eq(workers.machine_secret_hash, secretHash))
      .get()
    return worker?.id ?? null
  }
}

export class EnrollmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnrollmentError'
  }
}
