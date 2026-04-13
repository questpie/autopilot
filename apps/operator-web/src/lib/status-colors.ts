/**
 * Shared status color mapping used across tasks, automations, and results.
 * Keeps semantic color decisions in one place.
 * StatusPill remains the display component — this is the glue behind the UI.
 */

import type { StatusPillStatus } from '@/components/ui/status-pill'

// ── Task / Run status → pill ──

export function taskStatusToPill(status: string): StatusPillStatus {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'needs-input'
    case 'running':
    case 'claimed':
      return 'working'
    case 'completed':
      return 'done'
    case 'failed':
      return 'failed'
    case 'blocked':
      return 'blocked'
    default:
      return 'pending'
  }
}

// ── Task / Run status → left-border accent class ──

export function taskStatusBorder(status: string): string {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'border-l-amber-500'
    case 'running':
    case 'claimed':
      return 'border-l-blue-500'
    case 'completed':
      return 'border-l-green-500'
    case 'failed':
    case 'blocked':
      return 'border-l-red-500'
    default:
      return 'border-l-zinc-400'
  }
}

// ── Task / Run status → dot background class ──

export function taskStatusDot(status: string): string {
  switch (status) {
    case 'waiting_for_human_approval':
      return 'bg-amber-500'
    case 'running':
    case 'claimed':
      return 'bg-blue-500'
    case 'completed':
      return 'bg-green-500'
    case 'failed':
    case 'blocked':
      return 'bg-red-500'
    default:
      return 'bg-zinc-400'
  }
}

// ── Result type → chip style ──

export type ResultType = 'task' | 'query' | 'automation'

export function resultTypeChip(type: ResultType): string {
  switch (type) {
    case 'task':
      return 'bg-blue-500/10 text-blue-500'
    case 'query':
      return 'bg-green-500/10 text-green-500'
    case 'automation':
      return 'bg-zinc-500/10 text-zinc-400'
  }
}
