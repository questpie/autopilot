import { z } from 'zod'
import * as schemas from '../schemas'

// Company
export type Company = z.infer<typeof schemas.CompanySchema>
export type CompanyOwner = z.infer<typeof schemas.CompanyOwnerSchema>
export type CompanySettings = z.infer<typeof schemas.CompanySettingsSchema>
export type IntegrationConfig = z.infer<typeof schemas.IntegrationConfigSchema>
export type NotificationChannel = z.infer<typeof schemas.NotificationChannelSchema>

// Agents
export type Agent = z.infer<typeof schemas.AgentSchema>
export type AgentsFile = z.infer<typeof schemas.AgentsFileSchema>
export type FsScope = z.infer<typeof schemas.FsScopeSchema>
export type AgentTrigger = z.infer<typeof schemas.AgentTriggerSchema>

// Humans
export type Human = z.infer<typeof schemas.HumanSchema>
export type HumansFile = z.infer<typeof schemas.HumansFileSchema>
export type NotificationRouting = z.infer<typeof schemas.NotificationRoutingSchema>
export type QuietHours = z.infer<typeof schemas.QuietHoursSchema>

// Tasks
export type Task = z.infer<typeof schemas.TaskSchema>
export type TaskHistoryEntry = z.infer<typeof schemas.TaskHistoryEntrySchema>
export type TaskContext = z.infer<typeof schemas.TaskContextSchema>
export type Blocker = z.infer<typeof schemas.BlockerSchema>

// Messages
export type Message = z.infer<typeof schemas.MessageSchema>

// Workflows
export type Workflow = z.infer<typeof schemas.WorkflowSchema>
export type WorkflowStep = z.infer<typeof schemas.WorkflowStepSchema>
export type WorkflowOutput = z.infer<typeof schemas.WorkflowOutputSchema>
export type WorkflowReview = z.infer<typeof schemas.WorkflowReviewSchema>
export type WorkflowTransitions = z.infer<typeof schemas.WorkflowTransitionsSchema>
export type WorkflowChangelogEntry = z.infer<typeof schemas.WorkflowChangelogEntrySchema>
export type WorkflowChangePolicy = z.infer<typeof schemas.WorkflowChangePolicySchema>

// Schedules
export type Schedule = z.infer<typeof schemas.ScheduleSchema>

// Webhooks
export type Webhook = z.infer<typeof schemas.WebhookSchema>
export type WebhooksFile = z.infer<typeof schemas.WebhooksFileSchema>
export type WebhookFilter = z.infer<typeof schemas.WebhookFilterSchema>
export type WebhookAction = z.infer<typeof schemas.WebhookActionSchema>
export type WebhookTaskCondition = z.infer<typeof schemas.WebhookTaskConditionSchema>

// Watchers
export type Watcher = z.infer<typeof schemas.WatcherSchema>

// Thresholds
export type Threshold = z.infer<typeof schemas.ThresholdSchema>

// Memory
export type AgentMemory = z.infer<typeof schemas.AgentMemorySchema>
export type MemoryDecision = z.infer<typeof schemas.MemoryDecisionSchema>
export type MemoryMistake = z.infer<typeof schemas.MemoryMistakeSchema>
export type MemoryFacts = z.infer<typeof schemas.MemoryFactsSchema>

// Dashboard / Pins
export type Pin = z.infer<typeof schemas.PinSchema>
export type PinAction = z.infer<typeof schemas.PinActionSchema>
export type PinMetadata = z.infer<typeof schemas.PinMetadataSchema>
export type DashboardGroup = z.infer<typeof schemas.DashboardGroupSchema>
export type DashboardGroupsFile = z.infer<typeof schemas.DashboardGroupsFileSchema>

// Sessions
export type SessionMeta = z.infer<typeof schemas.SessionMetaSchema>
export type StreamChunk = z.infer<typeof schemas.StreamChunkSchema>

// Secrets
export type Secret = z.infer<typeof schemas.SecretSchema>

// Transports
export type TransportConfig = z.infer<typeof schemas.TransportConfigSchema>
export type TransportsFile = z.infer<typeof schemas.TransportsFileSchema>

// Policies
export type ApprovalGate = z.infer<typeof schemas.ApprovalGateSchema>
export type ApprovalGatesFile = z.infer<typeof schemas.ApprovalGatesFileSchema>
