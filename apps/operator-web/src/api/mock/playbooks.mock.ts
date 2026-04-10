import type { Playbook } from '../types'

export const mockPlaybooks: Playbook[] = [
  {
    id: 'pb_01JR8VQM3K0000000000000001',
    name: 'T\u00fd\u017edenn\u00fd content pl\u00e1n',
    description:
      'Automaticky priprav\u00ed 10 pr\u00edspevkov pre soci\u00e1lne siete na z\u00e1klade firemn\u00e9ho kontextu a sez\u00f3nnych t\u00e9m.',
    status: 'active',
    trigger: 'scheduled',
    skill_id: 'content-plan-weekly',
    linked_schedule_ids: ['sch_01JR8VQM3K0000000000000004'],
    resource_refs: ['company://menu-jar-2026.pdf', 'company://brand-guidelines.pdf'],
    last_used_at: '2026-04-06T09:00:00.000Z',
    usage_count: 12,
    success_rate: 0.92,
    created_at: '2026-01-25T10:00:00.000Z',
  },
  {
    id: 'pb_01JR8VQM3K0000000000000002',
    name: 'Anal\u00fdza recenzi\u00ed',
    description:
      'Zhrnie nov\u00e9 recenzie z Google a TripAdvisor, identifikuje trendy a navrhne odpovede na negat\u00edvne recenzie.',
    status: 'active',
    trigger: 'scheduled',
    skill_id: 'review-analyzer',
    linked_schedule_ids: ['sch_01JR8VQM3K0000000000000001'],
    resource_refs: [],
    last_used_at: '2026-04-01T06:00:00.000Z',
    usage_count: 28,
    success_rate: 0.96,
    created_at: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'pb_01JR8VQM3K0000000000000003',
    name: 'Pr\u00edprava newslettera',
    description:
      'Nap\u00ed\u0161e text newslettera pod\u013ea \u0161abl\u00f3ny, vyberie t\u00e9my z ned\u00e1vnych aktiv\u00edt a priprav\u00ed preview.',
    status: 'draft',
    trigger: 'manual',
    skill_id: 'newsletter-draft',
    linked_schedule_ids: [],
    resource_refs: ['company://svadobna-sezona-brief.md'],
    last_used_at: '2026-03-28T14:00:00.000Z',
    usage_count: 5,
    success_rate: 0.8,
    created_at: '2026-02-20T11:00:00.000Z',
  },
]
