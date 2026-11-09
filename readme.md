# Annunci · Gyver

Sezione con cui il Team Delivery trasforma una Job Offer in Annunci per Indeed, Instagram, TikTok e WhatsApp: un Brief di fatti pubblicabili, poi una Variante per ogni Focus, validata sui vincoli del canale e salvata come Versione immutabile. Vocabolario in [`GLOSSARY.md`](GLOSSARY.md), specifica in [`docs/SPEC.md`](docs/SPEC.md).

Altri documenti: [architecture.md](architecture.md) · [prompts.md](prompts.md) · [ai-workflows.md](ai-workflows.md) · [tradeoffs.md](tradeoffs.md)

## Prerequisiti

- **Bun ≥ 1.2** (sviluppato e testato con 1.4.4). Bun fa da runtime, gestore di pacchetti, test runner e driver SQLite (`bun:sqlite`): non serve Node.

```bash
curl -fsSL https://bun.sh/install | bash   # macOS / Linux
bun --version
```

- Una chiave OpenAI, **solo per generare** contenuti. Si crea su <https://platform.openai.com/api-keys>.

## Setup

```bash
bun install                 # dipendenze con versioni fissate (bun.lock)
cp .env.example .env        # poi inserisci la chiave in .env
bun run db:reset            # ricrea backend/data/gyver.db dallo schema e lo popola
bun run dev                 # backend + interfaccia su http://127.0.0.1:3000
```

Variabili d'ambiente (Bun legge `.env` da solo):

| Variabile | Default | A cosa serve |
|---|---|---|
| `OPENAI_API_KEY` | vuota | Chiave OpenAI. Senza chiave l'app parte lo stesso e la generazione risponde 503. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modello per Brief e Varianti. Deve supportare gli structured outputs. |
| `PORT` | `3000` | Porta HTTP. |
| `HOST` | `127.0.0.1` | Indirizzo di ascolto. Il default è solo locale. `0.0.0.0` espone il server sulla rete, ma **non c'è autenticazione**. |
| `DB_PATH` | `backend/data/gyver.db` | File SQLite. `db:reset` e il server usano lo stesso valore. |

Nessuna chiave è nel codice o nella repo: `.env` è in `.gitignore`.

### Database

`backend/data/gyver.db` è **già versionato e popolato**: il server parte anche senza `db:reset`. `bun run db:reset` ([`backend/scripts/db-reset.ts`](backend/scripts/db-reset.ts)) cancella il file, applica [`backend/src/db/schema.sql`](backend/src/db/schema.sql) ed esegue il seed ([`backend/src/db/seed.ts`](backend/src/db/seed.ts)):

- la Job Offer `jo_001` del PDF;
- i 4 Canali e i 6 Formati di Canale ammessi, con i vincoli;
- i 3 esempi del PDF come Annunci pubblicati, ciascuno con una Versione `manual`: WhatsApp immagine+testo, Indeed testo, Instagram immagine.

Ogni esempio passa da `validateContent` prima di entrare, quindi il seed non può contenere contenuti che l'API rifiuterebbe.

### Comandi

| Comando | Cosa fa |
|---|---|
| `bun run dev` | Server con riavvio automatico ([`backend/src/server.ts`](backend/src/server.ts)). |
| `bun run start` | Server senza watch. |
| `bun test` | 81 test di integrazione attraverso `createApp`, con DB in memoria e LLM finto: niente rete, niente chiave. |
| `bun run db:reset` | Ricrea e ripopola il DB. |
| `bun run gen:sample` | Genera un campione reale per ogni Formato di Canale di `jo_001` in `docs/samples/<versione-prompt>/`. Richiede la chiave e usa un DB in memoria, quindi `backend/data/gyver.db` non cambia. Senza chiave esce con codice 1. |

## Interfaccia

Backend e frontend sono lo stesso processo: `bun run dev` serve l'API e la pagina su **<http://127.0.0.1:3000>**. La UI (Preact + htm da CDN, nessun build step) è in [`frontend/`](frontend/). L'unico passo in più è la connessione a internet, per `esm.sh` e Google Fonts.

### Flusso completo (serve la chiave)

1. Apri <http://127.0.0.1:3000>: elenco Annunci con filtri per Job Offer, Canale e Stato. I 3 esempi del seed sono già lì.
2. **Nuovo Annuncio** (`#/new`): scegli `jo_001`, un Canale e un Formato (solo quelli ammessi) e da 1 a 3 Focus, tra quelli suggeriti o scritti liberi. Poi **Crea e genera**.
3. Il server genera il Brief (solo la prima volta per la Job Offer) e una Variante per Focus, e apre il dettaglio. L'anteprima dipende dal canale: volantino A4 per WhatsApp, riquadro 1:1 o 9:16 per i social, testo per Indeed. Sotto c'è la scheda della Creative.
4. Nella Variante: **Rigenera con LLM** crea una nuova Versione `llm`. **Modifica a mano** apre il JSON e lo salva come Versione `manual`; un contenuto non valido mostra gli errori campo per campo. **Scarta** / **Ripristina** cambia lo stato della Variante. Lo storico delle Versioni mostra l'Origine di ciascuna.
5. Cambia lo Stato o il Luogo dell'Annuncio, oppure aggiungi una Variante con un Focus nuovo.

**Senza chiave** funzionano l'elenco, i filtri, il dettaglio, le anteprime, la modifica manuale, lo Stato, il Luogo e lo scarto. Ogni azione che genera risponde `503 LLM_UNAVAILABLE` e la UI lo spiega in un banner.

## API

Errori sempre nella forma `{ "error": { "code", "message", "details?" } }`.

| Metodo e percorso | Cosa fa | Codici |
|---|---|---|
| `GET /api/job-offers` | Job Offer disponibili, solo `{ id, title, companyName, status }` | 200 |
| `GET /api/job-offers/:id` | Job Offer completa (payload interno incluso) con il Brief corrente (o `null`) | 200, 404 |
| `POST /api/job-offers/:id/brief` | Rigenera il Brief | 201, 404, 502, 503 |
| `GET /api/channels` | Canali con i Formati ammessi e i vincoli | 200 |
| `GET /api/angles` | Focus suggeriti | 200 |
| `GET /api/ads?job_offer_id=&channel=&status=` | Elenco, filtri combinabili | 200, 400 |
| `GET /api/ads/:id` | Dettaglio con le Varianti e la Versione corrente | 200, 404 |
| `POST /api/ads` | Crea un Annuncio in bozza e genera una Variante per Focus. Se tutti i Focus falliscono non salva nulla | 201 (con `failedAngles` se alcuni falliscono), 400, 404, 422, 502, 503 |
| `PATCH /api/ads/:id` | Stato e/o Luogo | 200, 400, 404, 422 `AD_HAS_NO_ACTIVE_VARIANT` (`ready`/`published` senza Varianti attive) |
| `POST /api/ads/:id/variants` | Nuova Variante generata | 201, 400, 404, 422 `AD_ARCHIVED`, 502, 503 |
| `GET /api/variants/:id/versions` | Storico delle Versioni | 200, 404 |
| `POST /api/variants/:id/regenerate` | Nuova Versione `llm`, stesso Focus | 201, 404, 422 `AD_ARCHIVED`, 502, 503 |
| `PUT /api/variants/:id/content` | Nuova Versione `manual`, se valida | 201, 404, 422 `INVALID_CONTENT` / `AD_ARCHIVED` |
| `PATCH /api/variants/:id` | `{ "active": false }` la scarta, `true` la ripristina (400 se il Focus è già attivo) | 200, 400, 404, 422 `AD_ARCHIVED` |
| `GET /api/health` | Stato del server | 200 |

```bash
# Elenco filtrato
curl 'http://127.0.0.1:3000/api/ads?channel=whatsapp&status=published'

# Creazione con due Focus (serve la chiave)
curl -X POST http://127.0.0.1:3000/api/ads -H 'content-type: application/json' \
  -d '{"job_offer_id":"jo_001","channel":"instagram","format":"image","angles":["carriera","stipendio"]}'

# Stato e Luogo
curl -X PATCH http://127.0.0.1:3000/api/ads/<adId> -H 'content-type: application/json' \
  -d '{"status":"paused","location":{"label":"Brescia e provincia"}}'

# Versione manuale: se non è valida risponde 422 con details.issues[{path,message}]
curl -X PUT http://127.0.0.1:3000/api/variants/<variantId>/content -H 'content-type: application/json' \
  -d '{"content":{ ...contenuto completo del tipo di canale... }}'

# Rigenerazione (serve la chiave)
curl -X POST http://127.0.0.1:3000/api/variants/<variantId>/regenerate
```

## Mappa della repo

```
backend/                 API, dominio, DB e test (TypeScript su Bun). Vedi backend/README.md
  src/
    server.ts            avvio: legge le env, apre il DB, crea il client OpenAI
    app.ts               createApp({ db, llm }): l'unico seam dei test, onError uniforme, file statici
    http/                route per area (job-offers, channels, ads, variants) ed errori (AppError)
    ads/                 casi d'uso degli Annunci e repository SQL
    generation/          Brief (riuso o creazione) → contenuto → validazione → 1 retry, con generation_runs
    llm/                 interfaccia LlmClient, client OpenAI, client finto, prompts/ versionati
    validation/          validateContent: schema, vincoli del Formato di Canale, regole di business
    domain/              tipi e schemi Zod (Brief, contenuto per tipo di canale, Creative)
    catalog/             lettura di Canali e Formati di Canale dal DB
    db/                  schema.sql, seed (jo_001 + esempi del PDF), apertura del DB
  test/                  test di integrazione via app.handle(Request)
  scripts/               db-reset.ts, gen-sample.ts
  data/gyver.db          DB SQLite già popolato
frontend/                UI Preact + htm senza build, servita sotto /assets. Vedi frontend/README.md
  index.html, styles.css
  app.js                 entry: router a hash e App
  lib/                   preact.js (unico import CDN), api.js, format.js, errors.js
  components/            ui.js, ad-list.js, ad-detail.js, ad-create.js
    previews/            anteprime per Canale: whatsapp.js, social.js, indeed.js
docs/                    SPEC, ADR, ai-log, prompt-log, report del giudice, campioni, cheat sheet di Elysia
.claude/agents/          agent di progetto (prompt-engineer, channel-judge, assessment-docs)
```
