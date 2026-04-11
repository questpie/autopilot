import type { Workflow } from '../types'

export const mockWorkflows: Workflow[] = [
  {
    id: 'wf_review_analysis',
    name: 'review-response',
    steps: [
      { name: 'on: new_review', type: 'trigger' },
      { name: 'analyze_sentiment', type: 'action' },
      { name: 'if: negative', type: 'condition' },
      { name: 'escalate_to_owner', type: 'action' },
    ],
  },
  {
    id: 'wf_weekly_report',
    name: 'weekly-report',
    steps: [
      { name: 'on: schedule(friday 17:00)', type: 'trigger' },
      { name: 'collect_metrics', type: 'action' },
      { name: 'generate_summary', type: 'action' },
      { name: 'send_to_slack', type: 'action' },
    ],
  },
  {
    id: 'wf_content_plan',
    name: 'content-pipeline',
    steps: [
      { name: 'on: manual_trigger', type: 'trigger' },
      { name: 'draft_posts', type: 'action' },
      { name: 'if: approved', type: 'condition' },
      { name: 'schedule_publish', type: 'action' },
    ],
  },
]
