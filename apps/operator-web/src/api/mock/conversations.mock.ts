/**
 * Enhanced mock conversations for demo.
 * Covers: query, task-backed thread, discussion/feedback thread.
 *
 * All types here use real backend contract types from @/api/types.
 */

import type { Session, SessionMessage, Artifact } from '@/api/types'

/**
 * UI-only conversation display type. Not a backend contract.
 * - `query` maps to SessionMode `query`.
 * - `task` maps to SessionMode `task_thread` (explicit task progress).
 * - `discussion` maps to SessionMode `task_thread` (discussion-style task).
 */
export type ConversationDisplayType = 'query' | 'task' | 'discussion'

export interface TaskSummaryView {
  id: string
  title: string
  status: string
  workflow_step: string | null
  runs_total: number
  runs_completed: number
}

export interface QuerySummaryView {
  id: string
  status: string
  run_id: string | null
  promoted_task_id?: string | null
}

export interface ConversationViewModel {
  session: Session
  displayType: ConversationDisplayType
  title: string
  lastPreview: string
  time: string
  messages: SessionMessage[]
  artifacts: Artifact[]
  task: TaskSummaryView | null
  queries: QuerySummaryView[]
}

// ── Conversation 1: "Content plan na april" — query promoted to task ──

const session1: Session = {
  id: 'conv-1',
  provider_id: 'demo',
  external_conversation_id: 'conv-1',
  external_thread_id: null,
  mode: 'task_thread',
  task_id: 'T-142',
  status: 'active',
  created_at: '2026-04-12T09:42:00Z',
  updated_at: '2026-04-12T09:55:00Z',
  metadata: '{}',
  runtime_session_ref: null,
  preferred_worker_id: null,
}

const conv1Messages: SessionMessage[] = [
  {
    id: 'c1-m1',
    session_id: 'conv-1',
    role: 'user',
    content: 'Priprav mi content plan na april. Chcem pokryť blog, social media aj newsletter.',
    query_id: null,
    external_message_id: null,
    metadata: '{}',
    created_at: '2026-04-12T09:42:10Z',
  },
  {
    id: 'c1-m2',
    session_id: 'conv-1',
    role: 'assistant',
    content: 'Rozumiem, pozriem sa na naše existujúce zdroje a pripravím plán. Dám ti návrh rozdelený podľa kanálov.',
    query_id: null,
    external_message_id: null,
    metadata: '{}',
    created_at: '2026-04-12T09:42:20Z',
  },
  {
    id: 'c1-m3',
    session_id: 'conv-1',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"tool_card":{"kind":"created","task_id":"T-142","task_title":"Content plán na apríl"}}',
    created_at: '2026-04-12T09:42:30Z',
  },
  {
    id: 'c1-m4',
    session_id: 'conv-1',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"progress","summary":"Konverzácia bola povýšená na úlohu"}}',
    created_at: '2026-04-12T09:42:40Z',
  },
  {
    id: 'c1-m5',
    session_id: 'conv-1',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"progress","summary":"Analýza zdrojov: Spracovaných 12 existujúcich článkov a 3 content piliere"}}',
    created_at: '2026-04-12T09:43:00Z',
  },
  {
    id: 'c1-m6',
    session_id: 'conv-1',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"progress","summary":"Návrh štruktúry: Blog: 8 článkov, Social: 24 postov, Newsletter: 4 edície"}}',
    created_at: '2026-04-12T09:44:00Z',
  },
  {
    id: 'c1-m7',
    session_id: 'conv-1',
    role: 'assistant',
    content: 'Plán je pripravený. Navrhol som 8 blog článkov, 24 social media postov a 4 newslettery. Rozpis je v artefakte.',
    query_id: null,
    external_message_id: null,
    metadata: '{"artifact_refs":[{"artifact_id":"c1-art-1","title":"Content plán — apríl 2026"}]}',
    created_at: '2026-04-12T09:50:00Z',
  },
  {
    id: 'c1-m8',
    session_id: 'conv-1',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"approval_needed","summary":"Čaká na schválenie"}}',
    created_at: '2026-04-12T09:55:00Z',
  },
]

const conv1Artifacts: Artifact[] = [
  {
    id: 'c1-art-1',
    run_id: 'run-c1-1',
    task_id: 'T-142',
    kind: 'doc',
    title: 'Content plán — apríl 2026',
    ref_kind: 'inline',
    ref_value: `# Content plán — apríl 2026

## Blog (8 článkov)

- **Týždeň 1:** Jarné trendy v káve 2026
- **Týždeň 1:** Ako vybrať správny mlynček
- **Týždeň 2:** Za kulisami: náš proces praženia
- **Týždeň 2:** 5 receptov na studené kávy
- **Týždeň 3:** Interview s naším head baristom
- **Týždeň 3:** Udržateľnosť v supply chain
- **Týždeň 4:** Guide: domáce latte art
- **Týždeň 4:** Mesačné zhrnutie a výhľad

## Social media (24 postov)

- 6× produktové fotky s popisom
- 6× tips & tricks (reels/stories)
- 4× behind the scenes
- 4× user generated content reshare
- 2× ankety / engagement posts
- 2× promo akcie

## Newsletter (4 edície)

- **1. apr:** Jarné novinky + akcia na predplatné
- **10. apr:** Recept týždňa + blog highlight
- **18. apr:** Zákulisie pražiarne + nové produkty
- **25. apr:** Mesačné zhrnutie + máj preview

---

**Celkový objem:** 36 content kusov
**Odhadovaný čas:** 18 hodín agentovej práce`,
    mime_type: 'text/markdown',
    metadata: '{}',
    blob_id: null,
    created_at: '2026-04-12T09:50:00Z',
  },
]

const conv1: ConversationViewModel = {
  session: session1,
  displayType: 'task',
  title: 'Content plán na apríl',
  lastPreview: 'Plán je pripravený — 8 článkov, 24 postov, 4 newslettery',
  time: '09:42',
  messages: conv1Messages,
  artifacts: conv1Artifacts,
  task: {
    id: 'T-142',
    title: 'Content plán na apríl',
    status: 'waiting',
    workflow_step: 'Schválenie',
    runs_total: 4,
    runs_completed: 3,
  },
  queries: [
    { id: 'q-c1-1', status: 'completed', run_id: 'run-c1-1', promoted_task_id: 'T-142' },
  ],
}

// ── Conversation 2: "Newsletter feedback" — discussion on T-147 ──

const session2: Session = {
  id: 'conv-2',
  provider_id: 'demo',
  external_conversation_id: 'conv-2',
  external_thread_id: null,
  mode: 'task_thread',
  task_id: 'T-147',
  status: 'active',
  created_at: '2026-04-12T08:15:00Z',
  updated_at: '2026-04-12T08:45:00Z',
  metadata: '{}',
  runtime_session_ref: null,
  preferred_worker_id: null,
}

const conv2Messages: SessionMessage[] = [
  {
    id: 'c2-m1',
    session_id: 'conv-2',
    role: 'system',
    content: 'Diskusia k úlohe T-147 · Newsletter k svadobnej sezóne',
    query_id: null,
    external_message_id: null,
    metadata: '{}',
    created_at: '2026-04-12T08:15:00Z',
  },
  {
    id: 'c2-m2',
    session_id: 'conv-2',
    role: 'assistant',
    content: 'Pripravil som draft newslettera k svadobnej sezóne. Prosím o review pred odoslaním.',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"approval_needed","summary":"Review newsletter draft"}}',
    created_at: '2026-04-12T08:15:30Z',
  },
  {
    id: 'c2-m3',
    session_id: 'conv-2',
    role: 'user',
    content: 'Predmet je príliš dlhý, skráť ho na max 50 znakov. A v sekcii "Pre nevestu" chýba zmienka o degustačnom menu.',
    query_id: null,
    external_message_id: null,
    metadata: '{}',
    created_at: '2026-04-12T08:20:00Z',
  },
  {
    id: 'c2-m4',
    session_id: 'conv-2',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"tool_use","summary":"Úprava draftu: Skracujem predmet a dopĺňam sekciu Pre nevestu"}}',
    created_at: '2026-04-12T08:25:00Z',
  },
  {
    id: 'c2-m5',
    session_id: 'conv-2',
    role: 'assistant',
    content: 'Hotovo. Predmet skrátený na "Svadobná sezóna: výnimočné chvíle" (42 znakov). Doplnená zmienka o degustačnom menu s cenami.',
    query_id: null,
    external_message_id: null,
    metadata: '{"artifact_refs":[{"artifact_id":"c2-art-1","title":"Newsletter draft v2"}]}',
    created_at: '2026-04-12T08:35:00Z',
  },
  {
    id: 'c2-m6',
    session_id: 'conv-2',
    role: 'assistant',
    content: '',
    query_id: null,
    external_message_id: null,
    metadata: '{"worker_event":{"type":"approval_needed","summary":"Schváliť upravený draft?"}}',
    created_at: '2026-04-12T08:45:00Z',
  },
]

const conv2Artifacts: Artifact[] = [
  {
    id: 'c2-art-1',
    run_id: 'run-c2-1',
    task_id: 'T-147',
    kind: 'doc',
    title: 'Newsletter draft v2',
    ref_kind: 'inline',
    ref_value: `# Svadobná sezóna: výnimočné chvíle

Predmet: Svadobná sezóna: výnimočné chvíle

---

## Milí zákazníci,

svadobná sezóna je tu a my sme pripravení spraviť váš deň nezabudnuteľný.

## Pre nevestu

- Svadobná torta na mieru — od klasiky po moderný dizajn
- Candy bar s 12+ druhmi sladkostí
- **Degustačné menu** — ochutnávka 5 chodov za zvýhodnenú cenu 39 €
- Kávový kútik pre hostí

## Pre ženícha

- Espresso bar na svadbe
- Darčekové balíčky pre svadobčanov
- Ranné kávy pre svadobnú prípravu

## Akcia

Objednaj svadobný balíček do konca mája a získaj 15% zľavu na candy bar.

---

S láskou, váš kaviarnový tím`,
    mime_type: 'text/markdown',
    metadata: '{}',
    blob_id: null,
    created_at: '2026-04-12T08:35:00Z',
  },
]

const conv2: ConversationViewModel = {
  session: session2,
  displayType: 'discussion',
  title: 'Newsletter feedback',
  lastPreview: 'Predmet skrátený, doplnené degustačné menu',
  time: '08:15',
  messages: conv2Messages,
  artifacts: conv2Artifacts,
  task: {
    id: 'T-147',
    title: 'Newsletter k svadobnej sezóne',
    status: 'waiting',
    workflow_step: 'Review',
    runs_total: 3,
    runs_completed: 2,
  },
  queries: [],
}

// ── Conversation 3: "Ako vyzeral marec?" — simple query ──

const session3: Session = {
  id: 'conv-3',
  provider_id: 'demo',
  external_conversation_id: 'conv-3',
  external_thread_id: null,
  mode: 'query',
  task_id: null,
  status: 'active',
  created_at: '2026-04-11T15:00:00Z',
  updated_at: '2026-04-11T15:10:00Z',
  metadata: '{}',
  runtime_session_ref: null,
  preferred_worker_id: null,
}

const conv3Messages: SessionMessage[] = [
  {
    id: 'c3-m1',
    session_id: 'conv-3',
    role: 'user',
    content: 'Ako vyzeral marec? Daj mi prehľad toho, čo sa podarilo a kde máme medzery.',
    query_id: null,
    external_message_id: null,
    metadata: '{}',
    created_at: '2026-04-11T15:00:00Z',
  },
  {
    id: 'c3-m2',
    session_id: 'conv-3',
    role: 'assistant',
    content: 'Pozrel som sa na marcové dáta. Tu je zhrnutie:',
    query_id: null,
    external_message_id: null,
    metadata: '{"artifact_refs":[{"artifact_id":"c3-art-1","title":"Marcový prehľad"}]}',
    created_at: '2026-04-11T15:05:00Z',
  },
]

const conv3Artifacts: Artifact[] = [
  {
    id: 'c3-art-1',
    run_id: 'run-c3-1',
    task_id: null,
    kind: 'doc',
    title: 'Marcový prehľad',
    ref_kind: 'inline',
    ref_value: `# Marec 2026 — prehľad

## Čo sa podarilo

- **Blog:** 6/6 článkov publikovaných, +23% návštevnosť MoM
- **Newsletter:** 4 edície, open rate 34.2% (nad priemer)
- **Social:** 18 postov, engagement rate 4.1%
- **Recenzie:** odpovede na 89% nových recenzií do 24h

## Medzery

- **Social:** chýbali 2 plánované reels (kapacitný výpadok)
- **Blog:** článok o udržateľnosti mal nízky engagement (1.2%)
- **Newsletter:** unsubscribe rate stúpol na 2.1% (z 1.6%)

## Kľúčové metriky

- Celkový content output: 28/30 (93%)
- Priemerný čas dodania: 2.1 dňa
- Sentiment recenzií: 4.6/5.0

## Odporúčanie na apríl

- Znížiť frekvenciu newslettera na 3× mesačne
- Nahradiť slabé formáty krátkym videom
- Pridať A/B testovanie predmetov emailov`,
    mime_type: 'text/markdown',
    metadata: '{}',
    blob_id: null,
    created_at: '2026-04-11T15:05:00Z',
  },
]

const conv3: ConversationViewModel = {
  session: session3,
  displayType: 'query',
  title: 'Ako vyzeral marec?',
  lastPreview: 'Blog +23%, newsletter open rate 34.2%, social engagement 4.1%',
  time: 'Včera',
  messages: conv3Messages,
  artifacts: conv3Artifacts,
  task: null,
  queries: [{ id: 'q-c3-1', status: 'completed', run_id: 'run-c3-1', promoted_task_id: null }],
}

export const mockConversations: ConversationViewModel[] = [conv1, conv2, conv3]
