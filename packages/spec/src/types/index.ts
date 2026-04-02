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

// Worker Events
export type WorkerEventType = z.infer<typeof schemas.WorkerEventTypeSchema>
export type WorkerEvent = z.infer<typeof schemas.WorkerEventSchema>
export type RunCompletion = z.infer<typeof schemas.RunCompletionSchema>

// Schedules
export type Schedule = z.infer<typeof schemas.ScheduleSchema>

// Humans
export type Human = z.infer<typeof schemas.HumanSchema>
export type NotificationRouting = z.infer<typeof schemas.NotificationRoutingSchema>
export type QuietHours = z.infer<typeof schemas.QuietHoursSchema>
