import type { Playbook, PlaybookStep, PlaybookExecution } from '../types'

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

export const mockPlaybookSteps: Record<string, PlaybookStep[]> = {
  pb_01JR8VQM3K0000000000000001: [
    { name: 'Pr\u00edprava kontextu', description: 'Na\u010d\u00edtanie firemn\u00e9ho kontextu, sez\u00f3nnych t\u00e9m a brand guidelines.', type: 'gather' },
    { name: 'Generovanie pr\u00edspevkov', description: 'Vytvorenie 10 n\u00e1vrhov pr\u00edspevkov pre soci\u00e1lne siete.', type: 'execute' },
    { name: 'Kontrola kvality', description: 'Overenie s\u00faladu s t\u00f3nom komunik\u00e1cie a brand guidelines.', type: 'review' },
    { name: 'V\u00fdstup a napl\u00e1novanie', description: 'Form\u00e1tovanie pre jednotliv\u00e9 platformy a napl\u00e1novanie publik\u00e1cie.', type: 'deliver' },
  ],
  pb_01JR8VQM3K0000000000000002: [
    { name: 'Zber recenzi\u00ed', description: 'Na\u010d\u00edtanie nov\u00fdch recenzi\u00ed z Google a TripAdvisor.', type: 'gather' },
    { name: 'Anal\u00fdza sentimentu', description: 'Klasifik\u00e1cia recenzi\u00ed pod\u013ea sentimentu a identifik\u00e1cia trendov.', type: 'execute' },
    { name: 'N\u00e1vrh odpoved\u00ed', description: 'Generovanie odpoved\u00ed na negat\u00edvne recenzie.', type: 'execute' },
    { name: 'Review a dorucenie', description: 'Kontrola odpoved\u00ed a odoslanie na schv\u00e1lenie.', type: 'review' },
  ],
  pb_01JR8VQM3K0000000000000003: [
    { name: 'V\u00fdber t\u00e9m', description: 'Anal\u00fdza ned\u00e1vnych aktiv\u00edt a v\u00fdber relevantn\u00fdch t\u00e9m.', type: 'gather' },
    { name: 'Tvorba obsahu', description: 'Nap\u00edsanie textu newslettera pod\u013ea \u0161abl\u00f3ny.', type: 'execute' },
    { name: 'Kontrola', description: 'Overenie gramatiky, t\u00f3nu a form\u00e1tovania.', type: 'review' },
    { name: 'Preview', description: 'Vygenerovanie preview a pr\u00edprava na odoslanie.', type: 'deliver' },
  ],
}

export const mockPlaybookExecutions: Record<string, PlaybookExecution[]> = {
  pb_01JR8VQM3K0000000000000001: [
    { date: '2026-04-06T09:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000010', status: 'completed', outcome: '10 pr\u00edspevkov pripraven\u00fdch a napl\u00e1novan\u00fdch' },
    { date: '2026-03-30T09:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000011', status: 'completed', outcome: '10 pr\u00edspevkov, 3 vr\u00e1ten\u00e9 na \u00fapravu' },
    { date: '2026-03-23T09:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000012', status: 'completed', outcome: '8 pr\u00edspevkov \u00faspe\u0161ne publikovan\u00fdch' },
    { date: '2026-03-16T09:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000013', status: 'failed', outcome: 'Zlyhanie pri na\u010d\u00edtan\u00ed brand guidelines' },
  ],
  pb_01JR8VQM3K0000000000000002: [
    { date: '2026-04-01T06:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000003', status: 'completed', outcome: '47 recenzi\u00ed analyzovan\u00fdch, 5 odpoved\u00ed navrhnut\u00fdch' },
    { date: '2026-03-01T06:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000014', status: 'completed', outcome: '32 recenzi\u00ed analyzovan\u00fdch, 2 odpovede' },
    { date: '2026-02-01T06:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000015', status: 'failed', outcome: 'Worker unavailable' },
  ],
  pb_01JR8VQM3K0000000000000003: [
    { date: '2026-03-28T14:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000016', status: 'completed', outcome: 'Newsletter pripraven\u00fd na odoslanie' },
    { date: '2026-03-14T14:00:00.000Z', task_id: 'tsk_01JR8VQM3K0000000000000017', status: 'completed', outcome: 'Newsletter odoslan\u00fd 1,200 pr\u00edjemcom' },
  ],
}
