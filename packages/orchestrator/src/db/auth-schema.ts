/**
 * Better Auth Drizzle schema.
 *
 * These table definitions mirror what Better Auth expects (core + plugins).
 * They are the single source of truth — Drizzle migrations create/update them,
 * and the drizzle adapter reads from them at runtime.
 *
 * Property names are camelCase to match Better Auth's internal field names.
 * Column names use snake_case following the default Better Auth convention.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─── User (core + admin plugin + twoFactor plugin) ─────────────────────────

export const user = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
		image: text('image'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		// admin plugin
		role: text('role'),
		banned: integer('banned', { mode: 'boolean' }).default(false),
		banReason: text('ban_reason'),
		banExpires: integer('ban_expires', { mode: 'timestamp' }),
		// twoFactor plugin
		twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' }).default(false),
	},
	(table) => [uniqueIndex('user_email_unique').on(table.email)],
)

// ─── Session (core + admin plugin) ─────────────────────────────────────────

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		token: text('token').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// admin plugin
		impersonatedBy: text('impersonated_by'),
	},
	(table) => [
		uniqueIndex('session_token_unique').on(table.token),
		index('session_user_id_idx').on(table.userId),
	],
)

// ─── Account ────────────────────────────────────────────────────────────────

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
		scope: text('scope'),
		password: text('password'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	},
	(table) => [index('account_user_id_idx').on(table.userId)],
)

// ─── Verification ───────────────────────────────────────────────────────────

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }),
		updatedAt: integer('updated_at', { mode: 'timestamp' }),
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)],
)

// ─── Two Factor (twoFactor plugin) ─────────────────────────────────────────

export const twoFactor = sqliteTable(
	'two_factor',
	{
		id: text('id').primaryKey(),
		secret: text('secret').notNull(),
		backupCodes: text('backup_codes').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
	},
	(table) => [
		index('two_factor_secret_idx').on(table.secret),
		index('two_factor_user_id_idx').on(table.userId),
	],
)

// ─── API Key (apiKey plugin) ────────────────────────────────────────────────

export const apikey = sqliteTable(
	'apikey',
	{
		id: text('id').primaryKey(),
		configId: text('config_id').notNull().default('default'),
		name: text('name'),
		start: text('start'),
		referenceId: text('reference_id').notNull(),
		prefix: text('prefix'),
		key: text('key').notNull(),
		refillInterval: integer('refill_interval'),
		refillAmount: integer('refill_amount'),
		lastRefillAt: integer('last_refill_at', { mode: 'timestamp' }),
		enabled: integer('enabled', { mode: 'boolean' }).default(true),
		rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' }).default(true),
		rateLimitTimeWindow: integer('rate_limit_time_window'),
		rateLimitMax: integer('rate_limit_max'),
		requestCount: integer('request_count').default(0),
		remaining: integer('remaining'),
		lastRequest: integer('last_request', { mode: 'timestamp' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		permissions: text('permissions'),
		metadata: text('metadata'),
	},
	(table) => [
		index('apikey_config_id_idx').on(table.configId),
		index('apikey_reference_id_idx').on(table.referenceId),
		index('apikey_key_idx').on(table.key),
	],
)

// ─── Rate Limit (Better Auth internal — rateLimit storage: 'database') ──────

export const rateLimit = sqliteTable(
	'rate_limit',
	{
		id: text('id').primaryKey(),
		key: text('key').notNull(),
		count: integer('count').notNull(),
		lastRequest: integer('last_request').notNull(),
	},
	(table) => [uniqueIndex('rate_limit_key_unique').on(table.key)],
)

// ─── Invite (dashboard onboarding + invite-only signup) ─────────────────────

export const invite = sqliteTable(
	'invite',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		role: text('role').notNull().default('member'),
		token: text('token').notNull(),
		invitedBy: text('invited_by'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }),
		acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
	},
	(table) => [
		uniqueIndex('invite_email_unique').on(table.email),
		uniqueIndex('invite_token_unique').on(table.token),
		index('invite_token_idx').on(table.token),
	],
)
