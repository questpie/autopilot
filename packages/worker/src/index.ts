export { AutopilotWorker } from './worker'
export type { WorkerConfig, WorkerCapability } from './worker'
export { loadCredential, saveCredential, clearCredential } from './credentials'
export type { StoredCredential } from './credentials'
export type { RuntimeAdapter, RunContext, RuntimeResult } from './runtimes/adapter'
export { SpawnAgentAdapter } from './runtimes/spawn-agent'
export type { SpawnAgentRuntimeConfig } from './runtimes/spawn-agent'
export { WorkspaceManager } from './workspace'
export type { WorkspaceInfo, WorkspaceManagerConfig } from './workspace'
export { resolveRuntime, createAdapter } from './runtime-config'
export type { RuntimeConfig, ResolvedRuntime } from './runtime-config'
export { resolveSecretRefs, validateSecretRefs } from './secrets'
export type { SecretResolutionResult } from './secrets'
export { executeActions, type ActionsMergedResult } from './actions/webhook'
export {
	executeScriptAction,
	type ScriptActionContext,
	type ScriptActionResult,
} from './actions/script'
export { createWorkerApi, startWorkerApi } from './api'
export type { WorkerApiConfig, WorkerApiDeps, WorkerApiServer, WorkerApiAppType } from './api'
export { createWorkerApiClient } from './api-client'
export * from './api-schemas'
// Re-export shared types from spec for convenience
export type {
	WorkerEvent,
	RunCompletion,
	ClaimedRun,
	WorkerClaimResponse,
	WorkerRegisterResponse,
} from '@questpie/autopilot-spec'
