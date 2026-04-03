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
export type ExecutionTarget = z.infer<typeof schemas.ExecutionTargetSchema>

// Environments
export type Environment = z.infer<typeof schemas.EnvironmentSchema>

// Secret Refs
export type SecretRef = z.infer<typeof schemas.SecretRefSchema>

// Artifacts
export type Artifact = z.infer<typeof schemas.ArtifactSchema>
export type RunArtifact = z.infer<typeof schemas.RunArtifactSchema>

// External Actions
export type ExternalAction = z.infer<typeof schemas.ExternalActionSchema>

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
