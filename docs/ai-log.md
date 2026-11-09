# AI log (materiale grezzo per ai-workflows.md e prompts.md)

## 2026-11-09 — Pianificazione e modellazione
- Piano scritto in plan mode con Claude Code (Opus 5.5); domande su stack, LLM, workflow risolte con AskUserQuestion.
- Stack scelto: Bun + Elysia, Preact + htm da CDN, bun:sqlite, OpenAI structured outputs.
- Design token letti dal CSS pubblico di gyver.work (palette, Archivo/DM Sans).
- Modellazione con skill Matt Pocock `grill-with-docs` (= `grilling` + `domain-modeling`): 3 round, 20 decisioni, output GLOSSARY.md + 3 ADR.
- Nota: le skill `grill-with-docs`, `to-spec`, `implement` hanno disable-model-invocation → vanno lanciate dall'umano.

## 2026-11-09 — Spec e agent di progetto
- `to-spec` (Matt Pocock) → docs/SPEC.md: 49 user story, schema, contratto API. Seam di test concordato: un solo seam HTTP (`createApp({db, llm})`) + `LlmClient` finto.
- 3 subagent in `.claude/agents/` scritti con `writing-for-agents`: prompt-engineer (iterazioni versionate + prompt-log), channel-judge (rubrica 7 criteri, giudice separato dal generatore), assessment-docs (checklist della traccia).
- Ricerca Elysia/Bun/OpenAI delegata a un agent in background con skill `research` → docs/research/elysia-bun.md (fonti primarie).

## 2026-11-09 — Fase 4 step 1: contratti (agent-code-writer)
- Scaffold backend: package.json con pin esatti (elysia 1.4.31, @elysia/static 1.4.12, openai 7.53.0, zod 4.6.7, typebox 0.34.52), tsconfig strict con `types: ["bun"]`, .env.example, .gitignore (journal/WAL/SHM ignorati, `data/gyver.db` versionato).
- Contratti per gli agent paralleli: tipi di dominio (`src/domain/types.ts`), schemi Zod del Brief e del contenuto per tipo di canale con Creative nullable, `LlmClient` + `LlmUnavailableError` + `FakeLlmClient` programmabile (code di passi, fallback, chiamate registrate), `validateContent` (solo parte Zod, TODO per vincoli e regole di business), interfaccia `GenerationService` con stub, `AppError` e helper.
- Schema SQL con CHECK sugli enum, `json_valid` sulle colonne JSON, FK composta `ads → channel_formats`, trigger che rendono `versions` append-only e vietano la cancellazione di ads/variants. `openDatabase` con `foreign_keys=ON` (+WAL su file). `createApp` con `onError` uniforme prima delle route, `GET /api/health`, smoke test.
- Il primo agent è stato interrotto da un errore di rete (ENOTFOUND) a metà lavoro; un secondo agent ha rivisto i file parziali, li ha tenuti quasi tutti e ha completato il resto (tsconfig, open-database, app, server, script, test).
- Cheat sheet: verificato con una prova che il pitfall 13 è reale. Elysia copia la proprietà `code` dell'errore lanciato nel `code` di `onError`, quindi `AppError` è riconosciuto con `instanceof` prima dello switch sul `code`. Verificato anche che un `onError` registrato sull'app prima di `.use(plugin)` copre le route del plugin. Scelta: errori di validazione Elysia → 400 (come da SPEC), non il 422 suggerito dal cheat sheet.
