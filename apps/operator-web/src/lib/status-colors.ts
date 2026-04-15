/**
 * Shared status color mapping used across tasks, automations, and results.
 * Keeps semantic color decisions in one place.
 * StatusPill remains the display component — this is the glue behind the UI.
 */

import type { StatusPillStatus } from '@/components/ui/status-pill'

// ── Task / Run status → pill ──

export function taskStatusToPill(status: string): StatusPillStatus {
  switch (status) {
    case 'active':
      return 'working'
    case 'blocked':
      return 'blocked'
    case 'done':
      return 'done'
    case 'failed':
      return 'failed'
    default: // backlog
      return 'pending'
  }
}

// ── Task / Run status → left-border accent class ──

export function taskStatusBorder(status: string): string {
  switch (status) {
    case 'active':
      return 'border-l-info'
    case 'blocked':
      return 'border-l-warning'
    case 'done':
      return 'border-l-success'
    case 'failed':
      return 'border-l-destructive'
    default:
      return 'border-l-muted-foreground'
  }
}

// ── Task / Run status → dot background class ──

export function taskStatusDot(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-info'
    case 'blocked':
      return 'bg-warning'
    case 'done':
      return 'bg-success'
    case 'failed':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground'
  }
}

// ── Result type → chip style ──

export type ResultType = 'task' | 'query' | 'automation'

export function resultTypeChip(type: ResultType): string {
  switch (type) {
    case 'task':
      return 'bg-info-surface text-info'
    case 'query':
      return 'bg-success-surface text-success'
    case 'automation':
      return 'bg-muted text-muted-foreground'
  }
}
