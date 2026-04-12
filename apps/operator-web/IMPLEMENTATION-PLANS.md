# Operator Web — Implementation Plans

Tento dokument je pracovný plán nad [EPICS.md](./EPICS.md).
Nemá nahrádzať produktový steering. Má pomôcť robiť konkrétne passy bez ďalšieho chaosu.

## Current truth

Aktuálna fáza:
- staviame plne funkčné demo s mockmi
- neriešime ešte plný real API wiring
- mockuje sa len data/backend vrstva
- UI, routing, state transitions a handoff flows majú byť reálne funkčné

Aktuálny orchestrator truth, na ktorý sa má operator-web viazať:
- session modes: `query`, `task_thread`
- `discussion` je zatiaľ product/UI presentation typ nad task-bound conversation flow
- schedules sú jediný aktívny runtime trigger primitive na main
- agent `triggers` sú reserved / inert
- standalone scripts sú už merge-nutý backend truth
- worker vie vykonať `script` aj `script_ref` actions
- generic trigger runtime stále nie je merge-nutý backend truth
- worktree je lazy runtime resource, nie implicitná entita tasku

## Plan A — Operator Core Alignment

Toto je najbližší implementation front. Má sa robiť priamo v `apps/operator-web`.

### Cieľ

Dorovnať operator-web na current truth, bez ďalšieho vymýšľania doménového modelu.

### Scope

1. Automatizácie
   - držať ich striktne nad `schedules`
   - nepôsobiť, že už máme širší trigger engine, keď na main ešte nie je
   - execution history a execution detail sheet ponechať
   - outcome model:
     - created task
     - created query
     - skipped / failed / blocked

2. Konverzácia
   - pracovať s `query` a `task_thread`
   - `discussion` ukazovať ako product-level thread flavor, nie ako samostatný backend session mode
   - browse/focus logic ďalej doladiť, ale nemení sa canonical backend model

3. Postupy vs Workflowy
   - prestať predstierať, že `Postupy` sú 1:1 workflow schema
   - `Postupy` majú byť user-facing abstraction layer
   - `Workflowy` sú dev/execution truth
   - medzi nimi musí byť jasný explanatory bridge:
     - kde sa postup používa
     - na aký workflow je naviazaný
     - čo z toho je authored logic a čo runtime execution

4. Scripts
   - v operator-web deme ich zatiaľ držať opatrne
   - môžu existovať ako forward-looking demo surface
   - ale nesmú pôsobiť ako fully merged backend truth

5. Consistency + i18n
   - odstrániť nové hardcoded texty
   - dorovnať page headers, list/detail rhythm, panel behavior
   - spraviť browser-driven consistency pass

### Definition of done

- žiadne dead UI
- žiadne capability overclaimy
- operator-web screeny sú konzistentné s current orchestrator truth
- build + typecheck prejdú

## Plan B — Product Surface Cleanup

Toto ide hneď po Plane A.

### Cieľ

Dorobiť produkčne silné detaily a znížiť vizuálny hluk.

### Scope

1. `Úlohy`
   - revision tree ako primary model
   - step detail on click
   - approvals / returns / discussions

2. `Výsledky`
   - provenance chain
   - result state clarity
   - preview vs no-preview states

3. `Zdroje`
   - business-facing detail
   - where-used
   - linked tasks / schedules / postupy

4. `Súbory`
   - tree-like technical surface
   - bez code-only bias
   - current demo truth jasno priznaná

## Plan C — Data Wiring Later

Toto nerobiť teraz.

### Keď na to príde čas

1. prepínať adaptery `mock -> api`
2. najprv:
   - tasks
   - runs/results
   - queries/chat
   - schedules
3. potom:
   - VFS-backed resources/files

## Pass order

Odporúčaný sled:

1. Plan A — Operator Core Alignment
2. Plan B — Product Surface Cleanup
3. až potom backend/data wiring

## Explicitly not now

Tieto veci teraz netlačiť:
- ďalšie research chaining tasky
- nový trigger platform model v appke
- full standalone script platform v UI ako keby už bola merge-nutá
- worktree cleanup automation
- project/widget/platform vrstvu pred operator core
