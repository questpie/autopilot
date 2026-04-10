/**
 * Enhanced mock conversations for demo.
 * Covers: query, task-backed thread, discussion/feedback thread.
 */

export type ConversationType = 'query' | 'task' | 'discussion'

export type MockMessageRole = 'user' | 'bot' | 'system'

export interface MockToolCard {
  kind: 'created' | 'updated'
  taskId: string
  taskTitle: string
}

export interface MockArtifactRef {
  artifactId: string
  label: string
}

export type MockArtifactType = 'document' | 'table' | 'code'

export interface MockArtifact {
  id: string
  title: string
  type: MockArtifactType
  content: string
}

export interface MockTaskEvent {
  kind: 'step_completed' | 'waiting_for_review' | 'step_started' | 'promoted'
  stepLabel: string
  detail?: string
}

export interface MockActionRequest {
  kind: 'approve_reject' | 'return_approve'
  label: string
}

export interface MockMessage {
  id: string
  role: MockMessageRole
  content: string
  toolCard?: MockToolCard
  artifactRef?: MockArtifactRef
  typing?: boolean
  taskEvent?: MockTaskEvent
  actionRequest?: MockActionRequest
}

export interface MockTaskSummary {
  taskId: string
  title: string
  status: string
  currentStep: string
  totalSteps: number
  completedSteps: number
  outputs: string[]
}

export interface MockConversation {
  id: string
  type: ConversationType
  title: string
  lastPreview: string
  time: string
  taskRef?: { taskId: string; taskTitle: string }
  promotedTo?: { taskId: string; taskTitle: string }
  messages: MockMessage[]
  artifacts: MockArtifact[]
  taskSummary?: MockTaskSummary
}

// ── Conversation 1: "Content plan na april" — query promoted to task ──

const conv1Messages: MockMessage[] = [
  {
    id: 'c1-m1',
    role: 'user',
    content: 'Priprav mi content plan na april. Chcem pokryť blog, social media aj newsletter.',
  },
  {
    id: 'c1-m2',
    role: 'bot',
    content: 'Rozumiem, pozriem sa na naše existujúce zdroje a pripravím plán. Dám ti návrh rozdelený podľa kanálov.',
  },
  {
    id: 'c1-m3',
    role: 'bot',
    content: '',
    toolCard: {
      kind: 'created',
      taskId: 'T-142',
      taskTitle: 'Content plán na apríl',
    },
  },
  {
    id: 'c1-m4',
    role: 'bot',
    content: '',
    taskEvent: {
      kind: 'promoted',
      stepLabel: 'Konverzácia bola povýšená na úlohu',
    },
  },
  {
    id: 'c1-m5',
    role: 'bot',
    content: '',
    taskEvent: {
      kind: 'step_completed',
      stepLabel: 'Analýza zdrojov',
      detail: 'Spracovaných 12 existujúcich článkov a 3 content piliere',
    },
  },
  {
    id: 'c1-m6',
    role: 'bot',
    content: '',
    taskEvent: {
      kind: 'step_completed',
      stepLabel: 'Návrh štruktúry',
      detail: 'Blog: 8 článkov, Social: 24 postov, Newsletter: 4 edície',
    },
  },
  {
    id: 'c1-m7',
    role: 'bot',
    content: 'Plán je pripravený. Navrhol som 8 blog článkov, 24 social media postov a 4 newslettery. Rozpis je v artefakte.',
    artifactRef: {
      artifactId: 'c1-art-1',
      label: 'Content plán — apríl 2026',
    },
  },
  {
    id: 'c1-m8',
    role: 'bot',
    content: '',
    taskEvent: {
      kind: 'waiting_for_review',
      stepLabel: 'Čaká na schválenie',
    },
    actionRequest: {
      kind: 'approve_reject',
      label: 'Schváliť content plán?',
    },
  },
]

const conv1Artifacts: MockArtifact[] = [
  {
    id: 'c1-art-1',
    title: 'Content plán — apríl 2026',
    type: 'document',
    content: `# Content plán — apríl 2026

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
  },
]

const conv1: MockConversation = {
  id: 'conv-1',
  type: 'task',
  title: 'Content plán na apríl',
  lastPreview: 'Plán je pripravený — 8 článkov, 24 postov, 4 newslettery',
  time: '09:42',
  promotedTo: { taskId: 'T-142', taskTitle: 'Content plán na apríl' },
  messages: conv1Messages,
  artifacts: conv1Artifacts,
  taskSummary: {
    taskId: 'T-142',
    title: 'Content plán na apríl',
    status: 'waiting',
    currentStep: 'Schválenie',
    totalSteps: 4,
    completedSteps: 3,
    outputs: ['Content plán — apríl 2026'],
  },
}

// ── Conversation 2: "Newsletter feedback" — discussion on T-147 ──

const conv2Messages: MockMessage[] = [
  {
    id: 'c2-m1',
    role: 'system',
    content: 'Diskusia k úlohe T-147 · Newsletter k svadobnej sezóne',
  },
  {
    id: 'c2-m2',
    role: 'bot',
    content: 'Pripravil som draft newslettera k svadobnej sezóne. Prosím o review pred odoslaním.',
    actionRequest: {
      kind: 'return_approve',
      label: 'Review newsletter draft',
    },
  },
  {
    id: 'c2-m3',
    role: 'user',
    content: 'Predmet je príliš dlhý, skráť ho na max 50 znakov. A v sekcii "Pre nevestu" chýba zmienka o degustačnom menu.',
  },
  {
    id: 'c2-m4',
    role: 'bot',
    content: '',
    taskEvent: {
      kind: 'step_started',
      stepLabel: 'Úprava draftu',
      detail: 'Skracujem predmet a dopĺňam sekciu Pre nevestu',
    },
  },
  {
    id: 'c2-m5',
    role: 'bot',
    content: 'Hotovo. Predmet skrátený na "Svadobná sezóna: výnimočné chvíle" (42 znakov). Doplnená zmienka o degustačnom menu s cenami.',
    artifactRef: {
      artifactId: 'c2-art-1',
      label: 'Newsletter draft v2',
    },
  },
  {
    id: 'c2-m6',
    role: 'bot',
    content: '',
    actionRequest: {
      kind: 'return_approve',
      label: 'Schváliť upravený draft?',
    },
  },
]

const conv2Artifacts: MockArtifact[] = [
  {
    id: 'c2-art-1',
    title: 'Newsletter draft v2',
    type: 'document',
    content: `# Svadobná sezóna: výnimočné chvíle

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
  },
]

const conv2: MockConversation = {
  id: 'conv-2',
  type: 'discussion',
  title: 'Newsletter feedback',
  lastPreview: 'Predmet skrátený, doplnené degustačné menu',
  time: '08:15',
  taskRef: { taskId: 'T-147', taskTitle: 'Newsletter k svadobnej sezóne' },
  messages: conv2Messages,
  artifacts: conv2Artifacts,
  taskSummary: {
    taskId: 'T-147',
    title: 'Newsletter k svadobnej sezóne',
    status: 'waiting',
    currentStep: 'Review',
    totalSteps: 3,
    completedSteps: 2,
    outputs: ['Newsletter draft v2'],
  },
}

// ── Conversation 3: "Ako vyzeral marec?" — simple query ──

const conv3Messages: MockMessage[] = [
  {
    id: 'c3-m1',
    role: 'user',
    content: 'Ako vyzeral marec? Daj mi prehľad toho, čo sa podarilo a kde máme medzery.',
  },
  {
    id: 'c3-m2',
    role: 'bot',
    content: 'Pozrel som sa na marcové dáta. Tu je zhrnutie:',
    artifactRef: {
      artifactId: 'c3-art-1',
      label: 'Marcový prehľad',
    },
  },
]

const conv3Artifacts: MockArtifact[] = [
  {
    id: 'c3-art-1',
    title: 'Marcový prehľad',
    type: 'document',
    content: `# Marec 2026 — prehľad

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
  },
]

const conv3: MockConversation = {
  id: 'conv-3',
  type: 'query',
  title: 'Ako vyzeral marec?',
  lastPreview: 'Blog +23%, newsletter open rate 34.2%, social engagement 4.1%',
  time: 'Včera',
  messages: conv3Messages,
  artifacts: conv3Artifacts,
}

export const mockConversations: MockConversation[] = [conv1, conv2, conv3]
