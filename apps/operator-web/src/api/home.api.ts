/**
 * Home screen adapter. Composes data from tasks and runs adapters
 * to build the home dashboard view model.
 * Mock-backed. Swap to real API: compose from /api/tasks + /api/runs + /api/schedules.
 */

import { delay } from './mock/delay'

export interface HomeAttentionItem {
  id: string
  title: string
  description: string
  status: 'ready' | 'needs-input'
  actions: Array<{ label: string; type: 'view' | 'approve' | 'change' }>
}

export interface HomeWorkingItem {
  id: string
  title: string
  elapsed: string
}

export interface HomeDoneItem {
  id: string
  title: string
  description: string
  time: string
}

export interface HomeDashboard {
  attention: HomeAttentionItem[]
  working: HomeWorkingItem[]
  done: HomeDoneItem[]
}

export async function getHomeDashboard(): Promise<HomeDashboard> {
  await delay(80)
  return {
    attention: [
      {
        id: '1',
        title: 'Content plán na apríl',
        description: '10 príspevkov pre Instagram a Facebook je pripravených.',
        status: 'ready',
        actions: [{ label: 'view', type: 'view' }],
      },
      {
        id: '2',
        title: 'Newsletter k svadobnej sezóne',
        description: 'Návrh textu je pripravený. Skontroluj a schváľ.',
        status: 'needs-input',
        actions: [
          { label: 'approve', type: 'approve' },
          { label: 'change', type: 'change' },
        ],
      },
    ],
    working: [
      { id: '1', title: 'Promo texty na víkendovú akciu', elapsed: '3 min' },
      { id: '2', title: 'Analýza recenzií za marec', elapsed: '1 min' },
    ],
    done: [
      {
        id: '1',
        title: 'Checklist pred víkendovou akciou',
        description: '15 položiek, vrátane zásobovania.',
        time: 'Dnes o 8:15',
      },
      {
        id: '2',
        title: 'Inzerát na novú baristku',
        description: 'Text inzerátu + návrh kde ho zverejniť.',
        time: 'Včera',
      },
    ],
  }
}
