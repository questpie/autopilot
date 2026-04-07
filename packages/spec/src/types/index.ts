import type { z } from 'zod'
import type * as schemas from '../schemas'

// Company
export type Company = z.infer<typeof schemas.CompanySchema>
export type CompanyOwner = z.infer<typeof schemas.CompanyOwnerSchema>
export type CompanySettings = z.infer<typeof schemas.CompanySettingsSchema>

// Agents
export type Agent = z.infer<typeof schemas.AgentSchema>
export type FsScope = z.infer<typeof schemas.FsScopeSchema>
export type AgentTrigger = z.infer<typeof schemas.AgentTriggerSchema>

// Workflows
export type Workflow = z.infer<typeof schemas.WorkflowSchema>
export type WorkflowStep = z.infer<typeof schemas.WorkflowStepSchema>
export type StepTransition = z.infer<typeof schemas.StepTransitionSchema>
export type ExecutionTarget = z.infer<typeof schemas.ExecutionTargetSchema>

// Environments
export type Environment = z.infer<typeof schemas.EnvironmentSchema>

// Secret Refs
export type SecretRef = z.infer<typeof schemas.SecretRefSchema>
export type LocalSecretRef = z.infer<typeof schemas.LocalSecretRefSchema>
export type SharedSecretRef = z.infer<typeof schemas.SharedSecretRefSchema>
export type SharedSecretScope = z.infer<typeof schemas.SharedSecretScopeSchema>
export type SharedSecretInput = z.infer<typeof schemas.SharedSecretInputSchema>
export type SharedSecretMetadata = z.infer<typeof schemas.SharedSecretMetadataSchema>

// Capability Profiles
export type CapabilityProfile = z.infer<typeof schemas.CapabilityProfileSchema>
export type ResolvedCapabilities = z.infer<typeof schemas.ResolvedCapabilitiesSchema>

// Artifacts
export type Artifact = z.infer<typeof schemas.ArtifactSchema>
export type RunArtifact = z.infer<typeof schemas.RunArtifactSchema>

// External Actions
export type ExternalAction = z.infer<typeof schemas.ExternalActionSchema>
export type WebhookAction = z.infer<typeof schemas.WebhookActionSchema>
export type ScriptAction = z.infer<typeof schemas.ScriptActionSchema>
export type ScriptResult = z.infer<typeof schemas.ScriptResultSchema>

// Worker Events
export type WorkerEventType = z.infer<typeof schemas.WorkerEventTypeSchema>
export type WorkerEvent = z.infer<typeof schemas.WorkerEventSchema>
export type RunCompletion = z.infer<typeof schemas.RunCompletionSchema>

// Worker API Contracts
export type WorkerCapability = z.infer<typeof schemas.WorkerCapabilitySchema>
export type ClaimedRun = z.infer<typeof schemas.ClaimedRunSchema>
export type WorkerClaimResponse = z.infer<typeof schemas.WorkerClaimResponseSchema>
export type WorkerRegisterResponse = z.infer<typeof schemas.WorkerRegisterResponseSchema>
export type ContinueRunRequest = z.infer<typeof schemas.ContinueRunRequestSchema>
export type WorkerEnrollRequest = z.infer<typeof schemas.WorkerEnrollRequestSchema>
export type WorkerEnrollResponse = z.infer<typeof schemas.WorkerEnrollResponseSchema>

// Schedules
export type Schedule = z.infer<typeof schemas.ScheduleSchema>

// Humans
export type Human = z.infer<typeof schemas.HumanSchema>
export type NotificationRouting = z.infer<typeof schemas.NotificationRoutingSchema>
export type QuietHours = z.infer<typeof schemas.QuietHoursSchema>

// Scope
export type CompanyScope = z.infer<typeof schemas.CompanyScopeSchema>
export type ProjectScope = z.infer<typeof schemas.ProjectScopeSchema>
export type ScopeDefaults = z.infer<typeof schemas.ScopeDefaultsSchema>
export type QueueConfig = z.infer<typeof schemas.QueueConfigSchema>

// Packs
export type PackDependency = z.infer<typeof schemas.PackDependencySchema>
export type Registry = z.infer<typeof schemas.RegistrySchema>
export type PackCategory = z.infer<typeof schemas.PackCategorySchema>
export type PackFile = z.infer<typeof schemas.PackFileSchema>
export type PackManifest = z.infer<typeof schemas.PackManifestSchema>
export type PackLockEntry = z.infer<typeof schemas.PackLockEntrySchema>
export type PackLockfile = z.infer<typeof schemas.PackLockfileSchema>

// Queries
export type QueryRequest = z.infer<typeof schemas.QueryRequestSchema>
export type QueryResult = z.infer<typeof schemas.QueryResultSchema>
export type QueryRow = z.infer<typeof schemas.QueryRowSchema>

// Sessions
export type SessionMode = z.infer<typeof schemas.SessionModeSchema>
export type SessionStatus = z.infer<typeof schemas.SessionStatusSchema>
export type SessionRow = z.infer<typeof schemas.SessionRowSchema>

// Providers
export type Provider = z.infer<typeof schemas.ProviderSchema>
export type ProviderKind = z.infer<typeof schemas.ProviderKindSchema>
export type ProviderCapability = z.infer<typeof schemas.ProviderCapabilitySchema>
export type ProviderEventFilter = z.infer<typeof schemas.ProviderEventFilterSchema>
export type HandlerEnvelope = z.infer<typeof schemas.HandlerEnvelopeSchema>
export type HandlerResult = z.infer<typeof schemas.HandlerResultSchema>
export type IntakeTaskInput = z.infer<typeof schemas.IntakeTaskInputSchema>
export type IntakeResult = z.infer<typeof schemas.IntakeResultSchema>
export type ConversationResult = z.infer<typeof schemas.ConversationResultSchema>
export type NotificationPayload = z.infer<typeof schemas.NotificationPayloadSchema>
export type NotificationAction = z.infer<typeof schemas.NotificationActionSchema>
