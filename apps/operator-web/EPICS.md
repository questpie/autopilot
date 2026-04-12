# Operator Web — Product Epics

Tento dokument zhŕňa produktový smer pre `apps/operator-web` po fáze HTML mockupov. Ďalšie passy sa majú opierať o tieto epiky, nie o izolované vizuálne nápady.

## Základné princípy

1. Minimalist-first
   - menej kariet, menej widgetov, menej dekorácie
   - viac typografie, rytmu, density, list-detail layoutov
   - detaily patria do sheetov a full pages, nie do card zoo

2. Truthful product
   - appka má mapovať to, čo Autopilot reálne vie cez CLI, API a worker surfaces
   - UI môže mockovať iba data layer, nie capability boundaries
   - ak niečo backend ešte nevie, použije sa seeded chat handoff alebo read-only surface, nie fake CRUD

3. Business vs technical surfaces
   - `Zdroje` = business-facing obsah a podklady
   - `Súbory` = technical FS/worktree/run surface
   - `Výsledky` = doručené výstupy a artefakty pre používateľa

4. Flat-first information architecture
   - zoznamy, riadky, split panes, timelines, tree views, full detail pages
   - cards len pre alert, callout, preview, empty state alebo summary block

5. Operator first, platform second
   - primárne riešime každodennú prácu s agentmi, taskami, výsledkami a zdrojmi
   - rozšíriteľnosť, projekty, widgety a mini appky prídu ako platformová vrstva nad stabilným základom

6. Orchestrator-owned domain model
   - tasky, workflowy, schedules, runy, eventy, konverzácie a discussions nemajú byť app-specific vynálezy
   - source of truth pre execution a collaboration model patrí orchestrátoru
   - operator-web je primárne surface nad orchestrator kontraktmi, nie samostatný business logic ostrov

## Kľúčové rozhodnutia

### Current phase decisions

Tieto rozhodnutia sú pre aktuálnu fázu uzamknuté, aby sa ďalšie passy zbytočne nerozchádzali.

1. Cieľ aktuálnej fázy
   - staviame plne funkčné demo s mockmi
   - ešte neriešime plné napojenie na reálne API/data layer
   - ďalšie passy nemajú byť HTML mockupy, ale reálne React implementácie

2. Truth rule
   - mockuje sa len backend/data vrstva
   - UI, routing, interakcie, state transitions a handoff flows majú byť reálne funkčné
   - žiadne dead buttons, žiadne fake CRUD bez aspoň demo-capability modelu

3. Source of truth
   - tasky, workflowy, schedules, runy, eventy, conversations, task discussions, approvals a steering patria orchestrátoru
   - operator-web ich surfacuje, ale nedefinuje vlastný paralelný doménový model

4. Information architecture
   - minimalist-first
   - flat-first
   - detail-first
   - `Výsledky` ostávajú first-class surface
   - `Zdroje` sú business-facing
   - `Súbory` sú technical/dev surface

5. Task detail model
   - primary history model = revision tree / progression tree
   - current progress strip je vždy hore
   - runs patria pod konkrétne kroky/revízie, nie ako oddelený top-level blok
   - audit log je sekundárny

6. Conversation model
   - query session, task thread a discussion model sú orchestrator concern
   - query sa môže promotnúť na task bez straty kontinuity
   - task approvals, returns for changes a steering nesmú byť iba app-specific UX hack

7. Demo architecture
   - adapter layer
   - contract-shaped mock providers
   - view-model mapping mimo route files
   - neskôr musí byť možné prepnúť `mock -> api` bez prekopania UI

8. Collaboration baseline
   - Better Auth rieši identity/session/invite/2FA baseline
   - produktová collaboration vrstva nad tým je náš systém:
     - role meaning
     - approvals
     - participants/followers
     - discussions
     - notification preferences

9. Platform boundary
   - projects / widgets / packs / mini apps / CMS sú dôležité
   - ale nemajú predbehnúť stabilizáciu operator core demo

10. Worktree lifecycle
   - worktree nie je core doménová entita tasku, ale runtime execution resource
   - task môže existovať bez worktree
   - query môže existovať bez worktree
   - run môže existovať bez worktree, ak daný execution path nepotrebuje filesystem
   - worktree sa má provisionovať lazy, až keď execution reálne potrebuje isolated filesystem surface
   - typické dôvody na vytvorenie worktree:
     - repo mutation
     - diff generation
     - workspace file reads/writes
     - script execution s FS access
     - artifact generation via workspace
   - approvals, reject/reply flow, metadata-only tasky a pure query/research flowy nemajú implicitne zakladať worktree
   - cleanup worktree lifecycle patrí runtime vrstve worker/orchestrator, nie product surface modelu

### Current research snapshot

Toto je priebežný steering snapshot z research taskov. Nie je to ešte finálny canonical execution model, ale je to aktuálny najlepší pracovný základ.

1. Conversation / collaboration
   - backend session modes ostávajú `query` a `task_thread`
   - `discussion` je UI / product presentation typ nad task-bound konverzáciou, nie samostatný public backend session mode
   - normalized conversation actions ostávajú:
     - `query.message`
     - `task.create`
     - `task.reply`
     - `task.approve`
     - `task.reject`
     - `task.discuss`
     - `conversation.command`
   - task participants sú first-class entita s rolami:
     - `owner`
     - `assignee`
     - `reviewer`
     - `follower`

2. Scripts / triggers
   - dlhodobý smer ostáva:
     - standalone scripts ako authored config
     - workflow actions môžu používať `script` aj `script_ref`
     - trigger model má byť širší než len schedules
   - current truth v merge-nutom kóde:
     - standalone scripts už existujú ako authored config primitive
     - orchestrator má read-only script API surface
     - worker vie vykonať `script` aj `script_ref` actions cez resolved script definitions
     - schedules sú stále jediný aktívny runtime trigger primitive
     - `AgentTriggerSchema` a agent `triggers` field sú zatiaľ reserved / inert
   - finálny generic trigger/runtime contract preto ešte stále nie je uzamknutý

3. Unified execution model
   - finálny canonical model pre `postup -> workflow -> trigger/schedule -> task/query -> run -> result` je ešte pending
   - treba ho uzamknúť až nad current truth stavu, nie nad nemerge-nutými experimentálnymi branch modelmi

### Výsledky ostávajú first-class surface

`Výsledky` nemajú byť schované pod `Zdroje` ani rozbité len na task/run detailoch.

Správny model:
- `Výsledky` = user-facing deliverables
- task/run detail = provenance, história a technický kontext
- `Zdroje` = vstupy
- `Súbory` = technický substrate

Všetko však musí byť silno cross-linkované:
- výsledok -> task -> run -> schedule -> postup -> zdroj -> súbory

### Files sú tree-like, Zdroje nie

`Súbory` majú mať tree view.
`Zdroje` majú byť library/list-detail view.

### Project editor nemá byť coder-first

Projektová vrstva má byť skôr `Lovable` / interný builder než IDE.
Kód môže byť prítomný, ale UI musí byť usable aj pre neprogramátora.

### QuestPie framework bude odporúčaný, nie vynucovaný

Na nové projekty a interné tools môže byť časom odporúčaný `QuestPie framework`, ale nesmie byť tvrdý predpoklad, kým nie je stabilný.

---

## Epic 1 — Scope-Aware VFS a file-backed forms

### Prečo

Veľa reálnych UI flowov je v skutočnosti zápis do súboru:
- firemný profil
- tone / context markdowny
- playbook-like config
- knowledge files
- jednoduché nastavenia a templaty

Bez VFS vrstvy UI aj agenti končia na raw cestách alebo ad hoc write logike.

### Cieľ

Zaviesť orchestrator-owned VFS primitive, ktorá abstrahuje file-backed obsah cez URI/handle model namiesto absolute paths.

### P0 scope

- `company://...`
  - read, list, stat, write
- `workspace://run/<runId>/...`
  - read, list, stat, diff
  - read-only

### Očakávané použitie

- Firma screen
- Kontexty a tone
- file-backed playbooky/configy
- Files explorer
- budúce remote agent tooly

### Dôležité pravidlá

- VFS != artifact/blob storage
- write iba do povolených scopeov
- žiadne absolute host paths v public contracte
- žiadny traversal

### Závislosti

- orchestrator API
- worker workspace read/list/diff/read-file surface
- typed schemas v `packages/spec`

### Výstup pre UI

- formuláre zapisujú do `company://...`
- dev surface číta z `workspace://run/...`
- UI vrstva nepozná host filesystem

---

## Epic 2 — Postupy, workflowy, schedules a tasky ako jeden execution systém

### Prečo

Dnes sú `Postupy`, `Workflowy`, `Schedules` a `Tasky` produktovo aj vizuálne rozpojené, pritom reálne ide o jednu execution graph vrstvu:
- postup = reusable know-how / behavior
- workflow = execution shape
- schedule = trigger a periodicita
- task = konkrétna inštancia práce v tomto systéme

### Cieľ

Spraviť z týchto entít prepojený, čitateľný a minimalistický surface model.

### UX model

#### Postupy

Majú mať full detail view, nie cards.

Preferovaný detail:
- jednoduchý lineárny flow
- alebo grid nodes s väzbami a jednoduchými `if` vetvami
- každý node ukazuje:
  - prompt / instructions
  - tools
  - vstupy
  - výstupy
  - linked workflow step
  - linked schedules
  - linked zdroje

#### Workflowy

Majú ukazovať:
- execution steps
- branching / fallback
- approvals
- script actions
- linked agents
- linked capability profiles

#### Schedules

Majú ukazovať:
- next run
- previous runs
- outcomes
- created tasks
- linked workflow/postup
- waiting / failure / blocked states

### Produktové pravidlo

Workflowy a schedules sa môžu v IA držať blízko seba alebo byť časom zlúčené do jednej surface s prepínateľnými views.

### Research pass — unified execution architecture

Tento research pass patrí primárne orchestrátoru, nie len operator-webu.

Musí zodpovedať:
- čo je rozdiel medzi `postupom`, `workflowom`, `schedule`, `taskom`, `runom` a `query`
- ktoré entity sú authored config / file-backed
- ktoré entity sú runtime inštancie
- ako sa z query stáva task
- ako schedule vytvára query vs task
- ako workflow vytvára ďalšie tasky / child tasky / approvals
- ako sa na to mapujú CLI surfaces a API routes

#### Navrhovaný model

- `Postup`
  - reusable business behavior
  - user-facing koncept
  - môže byť file-backed a editovaný cez AI handoff
- `Workflow`
  - executable graph
  - source of truth pre kroky, branching, approvals, joins, actions
- `Trigger`
  - dôvod spustenia
  - cron, webhook, event rule, manual, conversation/tool promotion
- `Schedule`
  - konkrétny time-based trigger config
- `Task`
  - durable work item vzniknutý z triggera, človeka alebo workflowu
- `Run`
  - jeden konkrétny pokus vykonať krok alebo query
- `Query`
  - chat/session scoped request, ktorá môže ostať query alebo byť promotnutá na task

#### Research otázky

1. Má byť `schedule` iba jeden typ triggera, alebo first-class surface popri širšom `trigger` modeli?
2. Má `workflow` vždy viesť na task, alebo sú legitimné aj workflowy, ktoré len vytvoria query/run/script without task wrapper?
3. Kedy má vzniknúť `task` automaticky a kedy má ostať vec len ako `query` alebo `script execution`?
4. Ako sa majú zobrazovať event-driven spustenia tak, aby tomu rozumel aj neprogramátor?

### Research pass — triggers, events a automation model

Toto je orchestrator epic s UI dôsledkami. Operator-web ho má surfacovať, nie definovať.

#### Cieľ

Premyslieť jednotný trigger/event model pre zložitejšie automatizácie:
- cron schedules
- webhook ingestion
- interné orchestrator eventy
- provider eventy
- manuálne spustenie z UI/CLI
- konverzačné/promoted triggers

#### Navrhovaný smer

- `Trigger` = deklarácia čo niečo spúšťa
- `Event` = fakt, že sa niečo stalo
- `Automation rule` = mapovanie eventu/triggeru na akciu
- `Action target` môže byť:
  - create task
  - create query
  - start workflow
  - execute script
  - call webhook

#### Minimum, ktoré musí byť pravda

- musí byť jasné, čo vec spustilo
- musí byť jasné, čo sa tým vytvorilo
- eventy musia byť auditovateľné
- duplicity a retry musia mať idempotency story
- trigger model musí vedieť neskôr obslúžiť aj widgety, projekty a mini appky

#### Research výstup

Výstupom nemá byť len UI nápad, ale orchestrator contract proposal:
- authored config shape
- runtime event schema
- rule evaluation model
- audit trail model
- UI surface model pre non-tech používateľa

---

## Epic 3 — First-class scripting

### Prečo

Autopilot potrebuje mať skriptovanie ako first-class capability:
- script actions vo workflowoch
- jednoduché widgety
- automatizácie
- interné tooling flows

### Cieľ

Zaviesť bezpečný a produktovo čitateľný scripting model.

### Požiadavky

1. Script actions vo workflowoch
   - najmä TypeScript
   - file-backed
   - napojené na inputs/outputs

2. Bun scripts ako explicitná capability
   - projekty môžu deklarovať podporované commandy
   - UI ich vie zobraziť a spúšťať cez kontrolovaný surface

3. MCP/tool primitive na execute TypeScript
   - script má vedieť volať iné tooly
   - musí ísť o kontrolovaný runtime, nie o nekontrolované arbitrary exec

4. Scriptable widgets a project actions
   - scripts nemajú žiť len vo workflowoch
   - chceme ich aj ako controlled execution surface pre projekty, widgety a interné tooly

### Guardrails

- skripty nesmú byť produktovo neviditeľná “black box”
- musia mať:
  - názov
  - popis
  - vstupy
  - výstupy
  - logy / výsledok
  - väzbu na workflow/task/run

### Out of scope pre prvý rez

- všeobecná plugin platforma bez modelu
- arbitrary JS execution bez capability boundaries

### Research pass — scripting architecture

Tento research pass je kombinovaný orchestrator + platform epic.

#### Čo už repo naznačuje

- workflow steps už majú `actions`
- existuje `script` external action primitive
- runner model už počíta s `bun`, `node`, `python3`, `bash`, `exec`

#### Čo treba rozhodnúť

1. Má byť first-class script model len file-backed (`scripts/*.ts`) alebo aj inline/authored config references?
2. Má byť primárny runtime `bun` a TypeScript, s ostatnými runnermi ako escape hatch?
3. Ako bude vyzerať sandbox:
   - filesystem scopes
   - env / secret access
   - network access
   - tool access
4. Má byť script execution len workflow action, alebo aj standalone callable primitive z UI/API/MCP?
5. Ako sa mapujú script outputs na artifacts / outputs / next-step inputs?

#### Preferovaný smer

- file-backed scripts ako default
- `bun`/TypeScript ako odporúčaný primary path
- explicitný contract pre:
  - inputs
  - outputs
  - artifacts
  - logs
  - capability access
- neskôr `execute typescript tool` s kontrolovaným prístupom k iným toolom

#### UX dôsledok

V appke nesmie script vyzerať len ako shell command.
Má byť čitateľný ako:
- čo robí
- kde sa používa
- čo potrebuje
- čo produkuje
- ako zlyhal

---

## Epic 4 — Widgety, sidebar rozšírenia a app extensibility

### Prečo

Operator web má mať schopnosť rozšírenia aj bez plného “developer IDE” módu.

Používateľ si časom bude chcieť:
- pridať quick links
- pridať interný widget
- zobraziť stav projektu, skriptu alebo feedu
- rozšíriť sidebar alebo dashboard o vlastné entry points

### Cieľ

Spraviť controlled extension model pre appku.

### Požadovaný smer

- file-backed manifesty
- widget definitions
- sidebar links
- page embeds / internal tool entries
- script-backed widgets

### Dôležitá hranica

Toto nesmie byť anarchia typu “nahraj hocijaký bundle a appka ho vyrenderuje”.
Musí existovať:
- manifest contract
- capability restrictions
- preview
- safe defaults

### Poznámka

Toto je platformová vrstva. Nemá predbehnúť stabilizáciu core operator surfaces.

---

## Epic 5 — Projekty ako first-class surface

### Prečo

Autopilot sa prirodzene tlačí aj do roviny:
- interné tooly
- mini appky
- headless CMS
- preview/deploy/project lifecycle

Bez `Projekty` surface sa tento smer nemá kde produktovo usadiť.

### Cieľ

Zaviesť `Projects view` ako first-class surface v appke.

### Produktový model

Projekt je:
- samostatný pracovný priestor
- s vlastnými taskami
- previews
- skriptami
- build/deploy surface
- možnými internými widgetmi a toolmi

### UX očakávanie

Nie coder-first IDE.
Skôr:
- lovable-like project editor
- live preview
- data/config driven edit flows
- code available behind the scenes
- task management naviazaný na projekt

### Požadované capabilities

- project list
- project detail
- active previews
- recent runs/tasky
- declared commands/scripts
- linked deployment surfaces

### Dôležité pravidlo

QuestPie framework môže byť odporúčaný default na nové projekty, ale nie vynútený, kým nie je stabilný.

### Research pass — project scripting, widgets a headless app model

Tento pass má spojiť viacero dnes rozdelených nápadov:
- scripts
- widgety
- sidebar links
- previews
- build/deploy commands
- internal tools
- mini CMS use cases

#### Research otázky

1. Čo je minimálna manifest vrstva pre projekt, aby appka vedela zobraziť:
   - widgets
   - previews
   - commands
   - deploy hooks
2. Ako sa budú deklarovať `bun` scripts a ktoré z nich sú safe-to-show / safe-to-run z appky?
3. Čo je rozdiel medzi:
   - projektový widget
   - interný tool
   - mini appka
   - preview
4. Kde končí operator-web a kde začína project runtime / questpie framework?

---

## Epic 6 — Headless CMS a embeddable mini appky

### Prečo

Reálny use case:
“teta si chce riadiť svoju kaviareň z Autopilota” a časom chce:
- obsah
- jednoduchý web
- interné tooly
- mini CMS
- preview a zmeny bez kódovania

### Cieľ

Pripraviť operator-web a project model na to, aby Autopilot vedel hostiť a spravovať aj malé appky a interné nástroje.

### Z čoho to bude stáť

- Projects
- previews system
- scripts
- VFS
- deployment surfaces
- widget/extension model

### Poznámka

Toto je neskorší platform epic. Nemá blokovať current operator core.

---

## Epic 7 — Skills, contexty a instruction preview

### Prečo

Používateľ potrebuje rozumieť:
- aké skills firma používa
- aké contexty sú aktívne
- čo sa ktorému agentovi injectuje
- odkiaľ agent berie správanie a znalosti

### Cieľ

Spraviť `Skills & Context` management ako first-class firemný surface.

### Musí obsahovať

- zoznam skills pod firmou
- context files / context packs
- väzby na agentov a workflowy
- preview výsledných instructions
- preview capability profiles
- “čo tento agent dostane pri spustení”

### UX model

Nie low-level prompt dump ako default.
Skôr vrstvený pohľad:
- business názov
- účel
- kde sa používa
- a až potom advanced instruction preview

---

## Epic 8 — Agenti a workflow ownership

### Prečo

Pri väčšom systéme bude treba vedieť:
- akí agenti existujú
- čo robia
- ktoré workflowy používajú
- aké majú contexts, skills, capability profiles, queues a runtime constraints

### Cieľ

First-class agent management naviazaný na workflowy.

### Minimum surface

- zoznam agentov
- detail agenta
- linked workflowy
- linked schedules
- linked skills/contexty
- instruction preview
- runtime / model / capability overview

### Research pass — agent/workflow/script ownership

Treba zodpovedať:
- ktorý agent vlastní ktorý workflow
- ktorý workflow používa ktoré scripts
- kde sa injectujú contexts a skills
- ako to celé previewnúť tak, aby človek videl “čo tento agent reálne dostane”
- ako sa to odlíši od runtime run detailu

---

## Epic 9 — Pack management

### Prečo

Packový systém je súčasť architektúry. Ak má byť produktovo použiteľný, potrebuje aj vlastný management surface.

### Cieľ

Spraviť first-class pack management pod firmou / workspace.

### Minimum surface

- zoznam packov
- stav packu
- čo pack pridáva:
  - skills
  - workflows
  - agents
  - surfaces
  - contexty
- update/install/remove flow
- conflict / dependency visibility

### Dôležité pravidlo

Pack surface má byť zrozumiteľný aj neprogramátorovi, nie len ako raw registry inspector.

---

## Epic 10 — Results and artifact model for non-technical users

### Prečo

Artefakty, výsledky, run outputs a technical files sa ľahko pomiešajú.

### Rozhodnutie

Pre neskúsených ľudí:
- `Výsledky` ostávajú samostatné
- `Zdroje` sú vstupy
- `Súbory` sú technické

### Čo musí byť pravda

- výsledok sa dá otvoriť bez znalosti task/run modelu
- vždy je jasné:
  - odkiaľ vznikol
  - kto ho vytvoril
  - či je draft/final
  - kde je preview
  - ako sa vrátim na task/run/thread

### Pokročilé cross-linky

- výsledok -> task
- výsledok -> run
- výsledok -> schedule
- výsledok -> postup
- výsledok -> zdroje
- výsledok -> súbory / raw artifacts

---

## Epic 11 — Conversations, task threads a discussions

### Prečo

Chat, query sessions, task threads, approvals a diskusie k taskom nemajú byť len UI pattern.
Je to orchestrator-owned collaborative surface, ktorú musia zdieľať:
- operator-web
- Telegram / iné providers
- CLI
- budúce surfaces

### Cieľ

Premyslieť jednotný conversation model tak, aby:
- query ostala query, keď má
- task thread bol first-class, keď vznikne práca
- diskusia k tasku nebola len bočný hack
- approvals, feedback a steer messages mali konzistentný domov

### Navrhovaný model

- `Conversation / Session`
  - surface-level thread identity
- `Query`
  - jednorazová alebo pokračujúca konverzačná požiadavka
- `Task thread`
  - vlákno naviazané na konkrétny task
- `Discussion`
  - komentáre, feedback, approve/reject/reply, steering
- `Session messages`
  - raw história správ

### Research pass — chat/task/discussion architecture

Tento pass patrí orchestrátoru. Appka ho len renderuje.

#### Musí zodpovedať

1. Kedy vzniká query session vs task thread?
2. Ako sa query promotuje na task bez straty kontinuity?
3. Kde žije diskusia k tasku:
   - v task threade
   - v samostatných comments
   - alebo ako kombinácia oboch?
4. Ako sa modelujú:
   - approvals
   - returns for changes
   - steering messages
   - provider replies
5. Ako zabezpečiť, aby task diskusia bola rovnaká v CLI, Telegrame aj webe?

#### Produktové pravidlo

Chat nie je len app-specific UX.
Je to collaborative execution surface nad orchestrator sessions, queries, task threads a session messages.

---

## Epic 12 — Identity, user management a collaboration

### Prečo

Better Auth nám dáva základ:
- sessions
- users
- invites
- 2FA
- role baseline

Ale produktová vrstva tým nekončí.
Autopilot potrebuje first-class collaboration model:
- kto čo vidí
- kto čo schvaľuje
- kto je owner/admin/member/viewer
- kto je follower tasku
- kto dostáva notifikácie
- ako fungujú shared discussions, approvals a presence

### Cieľ

Premyslieť identity a collaboration vrstvu ako orchestrator domain, nie len Settings screen.

### Research pass — auth to collaboration bridge

#### Musí zodpovedať

1. Ktoré veci rieši Better Auth out-of-the-box a ktoré musíme pridať my?
2. Ako sa Better Auth role mapujú na produktové capabilities:
   - read
   - write
   - approve
   - manage agents/workflows/packs
   - run scripts / project actions
3. Máme potrebovať:
   - mentions
   - watchers/followers
   - per-task assignees vs approvers
   - notification preferences
   - shared inbox / approvals queue
4. Ako sa collaborative model zobrazí v appke bez enterprise balastu?

### Minimum product layer nad Better Auth

- user directory
- invites
- role visibility
- approval rights
- task followers / participants
- discussion participants
- audit visibility
- notification preferences

---

## Odporúčané poradie realizácie

### Fáza 1 — Operator core stabilizácia

1. Flat/detail core surfaces
   - Úlohy
   - Výsledky
   - Konverzácia
   - Zdroje
   - Súbory
2. React demo nad reálnymi kontraktmi, mockovaná len API vrstva
3. Scope-aware VFS P0

### Fáza 2 — Execution modeling

4. Postupy + workflowy + schedules
5. First-class scripting
6. Agent management + instruction preview
7. Unified conversation/task discussion model
8. Auth + collaboration model

### Fáza 3 — Platform surfaces

9. Projects
10. Pack management
11. Widgets / extensions
12. Headless CMS / mini apps / deployment layer

---

## Open questions

1. Majú byť workflowy a schedules v jednej spoločnej sekcii, alebo oddelené, ale silno prepojené?
2. Má byť `Projects` top-level sekcia už v skoršej fáze, alebo až po stabilizácii operator core?
3. Ako presne obmedziť script runtime a tool access tak, aby bol bezpečný, ale stále dosť silný?
4. Kedy začať odporúčať QuestPie framework ako default pre nové projekty?
5. Ktoré file-backed entity budú explicitne first-class cez VFS ako prvé?
6. Kedy vzniká `task` vs `query` vs `script run` ako first-class runtime objekt?
7. Má byť `schedule` len jeden typ triggera v širšom trigger modeli?
8. Ako sa má modelovať task discussion tak, aby bola jednotná naprieč web/CLI/providers?
9. Ktoré collaborative capabilities rieši Better Auth a ktoré musia byť orchestrator-native?

---

## Praktický steering pre ďalšie passy

Pri ďalšej práci na `apps/operator-web` platí:

- nevymýšľať nové entity mimo backend modelu
- držať sa minimalist-first a flat/detail princípov
- mockovať len API/data layer
- všetko nové mapovať na CLI/API/worker surfaces
- business-facing surfaces robiť zrozumiteľné aj pre neprogramátora
- technical surfaces schovať do `Dev mode`, ale nesimplifikovať ich do nepravdy
