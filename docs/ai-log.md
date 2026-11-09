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

## 2026-11-09 — Fase 4 step 2: dati/API e pipeline LLM in parallelo
- Due agent in parallelo, entrambi `agent-code-writer`, con ownership dei file rigida e firme concordate prima di partire (`findJobOffer`, `findChannel`, `findChannelFormat`, `listChannelsWithFormats`, `validateContent`, `createGenerationService`, `findCurrentBrief`, `createOpenAiLlmClient`): agent A su dati e API (repository, casi d'uso Annunci, route, seed), agent B sulla pipeline LLM (generation service con retry e `generation_runs`, regole di business, prompt, client OpenAI).
- Durante il lavoro `gen:sample` e `tsc` di B si sono rotti per poco perché `seed.ts` di A non esisteva ancora: atteso, risolto all'unione.
- Trappola Elysia trovata da A: `t.UnionEnum` dentro `t.Optional` inietta il primo valore come default. `?channel=indeed` diventava `status=draft` e `PATCH {}` andava a buon fine. Sostituito con `t.Union` di `t.Literal`.
- Il pitfall 3 del cheat sheet ("onError registrato prima del plugin non viene ereditato") è smentito dall'osservazione: l'`onError` dell'app copre le route dei plugin montati dopo.
- B si è scostato dal cheat sheet: usa `chat.completions.create` + `zodResponseFormat` + un proprio `JSON.parse` invece di `.parse()`, perché `.parse()` lancia `ZodError` se l'output non combacia e perde il testo grezzo che serve per `generation_runs` e per il retry.
- Importare `elysia` da fuori dalla repo fa auto-installare Elysia 2.0 dalla cache globale di Bun: gli script di prova vanno lanciati dentro la repo.
- Integrazione (agent-tester): `bun install`, `bunx tsc --noEmit`, `bun test`, `bun run db:reset` verdi; `env -u OPENAI_API_KEY bun run gen:sample` esce con codice 1 e un messaggio chiaro, senza stack trace. Nessun glitch di integrazione da correggere. Avvio del server senza chiave verificato a mano: `GET /api/ads` restituisce i 3 esempi del seed, `POST /api/job-offers/jo_001/brief` dà 503 `LLM_UNAVAILABLE`. Quel 503 registra comunque una riga `generation_runs` con esito `error` nel DB su file, quindi `data/gyver.db` è stato ricreato con `db:reset` prima del commit.
