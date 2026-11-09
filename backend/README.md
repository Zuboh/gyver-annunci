# Backend

API HTTP, generazione LLM, validazione e DB SQLite. TypeScript su Bun ed Elysia, senza build. Serve anche la UI di [`../frontend/`](../frontend/) dallo stesso processo.

## Moduli

| Cartella | Contenuto |
|---|---|
| [`src/server.ts`](src/server.ts) | Avvio: legge le env, apre il DB, crea il client OpenAI |
| [`src/app.ts`](src/app.ts) | `createApp({ db, llm })`: route, errori uniformi, file statici (`/` e `/assets/*`). È l'unico seam dei test |
| [`src/http/`](src/http/) | Route per area ed `AppError` |
| [`src/ads/`](src/ads/) | Casi d'uso degli Annunci e repository SQL |
| [`src/generation/`](src/generation/) | Brief → contenuto → validazione → retry, con `generation_runs` |
| [`src/llm/`](src/llm/) | `LlmClient`, client OpenAI, client finto, prompt versionati |
| [`src/validation/`](src/validation/) | `validateContent`: schema, vincoli del Formato, regole di business |
| [`src/domain/`](src/domain/) | Tipi e schemi Zod |
| [`src/catalog/`](src/catalog/), [`src/db/`](src/db/) | Canali e Formati; schema SQL, seed, apertura del DB |
| [`test/`](test/) | Test di integrazione via `app.handle(Request)`, DB in memoria e LLM finto |
| [`scripts/`](scripts/) | `db-reset.ts`, `gen-sample.ts` |
| [`data/gyver.db`](data/gyver.db) | DB SQLite già popolato |

## Comandi (dalla radice della repo)

```bash
bun run dev         # server con riavvio automatico
bun run start       # server
bun run db:reset    # ricrea backend/data/gyver.db
bun run test        # test di integrazione
bunx tsc --noEmit   # controllo dei tipi
bun run gen:sample  # campioni reali, richiede OPENAI_API_KEY
```

Dettagli in [`../readme.md`](../readme.md) e [`../architecture.md`](../architecture.md).
