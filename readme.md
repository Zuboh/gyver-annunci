# Annunci · Gyver

Sezione con cui il Team Delivery trasforma una Job Offer in Annunci per Indeed, Instagram, TikTok e WhatsApp: un Brief di fatti pubblicabili, poi una Variante per ogni Angolo, validata sui vincoli del canale e salvata come Versione immutabile. Vocabolario in [`GLOSSARY.md`](GLOSSARY.md), specifica in [`docs/SPEC.md`](docs/SPEC.md).

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
bun run db:reset            # ricrea data/gyver.db dallo schema e lo popola
bun run dev                 # backend + interfaccia su http://localhost:3000
```

Variabili d'ambiente (Bun legge `.env` da solo):

| Variabile | Default | A cosa serve |
|---|---|---|
| `OPENAI_API_KEY` | vuota | Chiave OpenAI. Senza chiave l'app parte lo stesso e la generazione risponde 503. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modello per Brief e Varianti. Deve supportare gli structured outputs. |
| `PORT` | `3000` | Porta HTTP. |
| `DB_PATH` | `data/gyver.db` | File SQLite. `db:reset` e il server usano lo stesso valore. |

Nessuna chiave è nel codice o nella repo: `.env` è in `.gitignore`.

### Database

`data/gyver.db` è **già versionato e popolato**: il server parte anche senza `db:reset`. `bun run db:reset` ([`scripts/db-reset.ts`](scripts/db-reset.ts)) cancella il file, applica [`src/db/schema.sql`](src/db/schema.sql) ed esegue il seed ([`src/db/seed.ts`](src/db/seed.ts)):

- la Job Offer `jo_001` del PDF;
- i 4 Canali e i 6 Formati di Canale ammessi, con i vincoli;
- i 3 esempi del PDF come Annunci pubblicati, ciascuno con una Versione `manual`: WhatsApp immagine+testo, Indeed testo, Instagram immagine.

Ogni esempio passa da `validateContent` prima di entrare, quindi il seed non può contenere contenuti che l'API rifiuterebbe.

### Comandi

| Comando | Cosa fa |
|---|---|
| `bun run dev` | Server con riavvio automatico ([`src/server.ts`](src/server.ts)). |
| `bun run start` | Server senza watch. |
| `bun test` | 56 test di integrazione attraverso `createApp`, con DB in memoria e LLM finto: niente rete, niente chiave. |
| `bun run db:reset` | Ricrea e ripopola il DB. |
| `bun run gen:sample` | Genera un campione reale per ogni Formato di Canale di `jo_001` in `docs/samples/<versione-prompt>/`. Richiede la chiave e usa un DB in memoria, quindi `data/gyver.db` non cambia. Senza chiave esce con codice 1. |

## Interfaccia

Backend e frontend sono lo stesso processo: `bun run dev` serve l'API e la pagina su **<http://localhost:3000>**. La UI (Preact + htm da CDN, nessun build step) è in [`public/`](public/). L'unico passo in più è la connessione a internet, per `esm.sh` e Google Fonts.

### Flusso completo (serve la chiave)

1. Apri <http://localhost:3000>: elenco Annunci con filtri per Job Offer, Canale e Stato. I 3 esempi del seed sono già lì.
2. **Nuovo Annuncio** (`#/new`): scegli `jo_001`, un Canale e un Formato (solo quelli ammessi) e da 1 a 3 Angoli, tra quelli suggeriti o scritti liberi. Poi **Crea e genera**.
3. Il server genera il Brief (solo la prima volta per la Job Offer) e una Variante per Angolo, e apre il dettaglio. L'anteprima dipende dal canale: volantino A4 per WhatsApp, riquadro 1:1 o 9:16 per i social, testo per Indeed. Sotto c'è la scheda della Creative.
4. Nella Variante: **Rigenera con LLM** crea una nuova Versione `llm`. **Modifica a mano** apre il JSON e lo salva come Versione `manual`; un contenuto non valido mostra gli errori campo per campo. **Scarta** / **Ripristina** cambia lo stato della Variante. Lo storico delle Versioni mostra l'Origine di ciascuna.
5. Cambia lo Stato o il Luogo dell'Annuncio, oppure aggiungi una Variante con un Angolo nuovo.

**Senza chiave** funzionano l'elenco, i filtri, il dettaglio, le anteprime, la modifica manuale, lo Stato, il Luogo e lo scarto. Ogni azione che genera risponde `503 LLM_UNAVAILABLE` e la UI lo spiega in un banner.

## API

Errori sempre nella forma `{ "error": { "code", "message", "details?" } }`.

| Metodo e percorso | Cosa fa | Codici |
|---|---|---|
| `GET /api/job-offers` | Job Offer disponibili | 200 |
| `GET /api/job-offers/:id` | Job Offer con il Brief corrente (o `null`) | 200, 404 |
| `POST /api/job-offers/:id/brief` | Rigenera il Brief | 201, 404, 502, 503 |
| `GET /api/channels` | Canali con i Formati ammessi e i vincoli | 200 |
| `GET /api/angles` | Angoli suggeriti | 200 |
| `GET /api/ads?job_offer_id=&channel=&status=` | Elenco, filtri combinabili | 200, 400 |
| `GET /api/ads/:id` | Dettaglio con le Varianti e la Versione corrente | 200, 404 |
| `POST /api/ads` | Crea un Annuncio in bozza e genera una Variante per Angolo | 201 (con `failedAngles`), 400, 404, 422, 502, 503 |
| `PATCH /api/ads/:id` | Stato e/o Luogo | 200, 400, 404 |
| `POST /api/ads/:id/variants` | Nuova Variante generata | 201, 400, 404, 502, 503 |
| `GET /api/variants/:id/versions` | Storico delle Versioni | 200, 404 |
| `POST /api/variants/:id/regenerate` | Nuova Versione `llm`, stesso Angolo | 201, 404, 502, 503 |
| `PUT /api/variants/:id/content` | Nuova Versione `manual`, se valida | 201, 404, 422 |
| `PATCH /api/variants/:id` | `{ "active": false }` la scarta | 200, 404 |
| `GET /api/health` | Stato del server | 200 |

```bash
# Elenco filtrato
curl 'http://localhost:3000/api/ads?channel=whatsapp&status=published'

# Creazione con due Angoli (serve la chiave)
curl -X POST http://localhost:3000/api/ads -H 'content-type: application/json' \
  -d '{"job_offer_id":"jo_001","channel":"instagram","format":"image","angles":["carriera","stipendio"]}'

# Stato e Luogo
curl -X PATCH http://localhost:3000/api/ads/<adId> -H 'content-type: application/json' \
  -d '{"status":"paused","location":{"label":"Brescia e provincia"}}'

# Versione manuale: se non è valida risponde 422 con details.issues[{path,message}]
curl -X PUT http://localhost:3000/api/variants/<variantId>/content -H 'content-type: application/json' \
  -d '{"content":{ ...contenuto completo del tipo di canale... }}'

# Rigenerazione (serve la chiave)
curl -X POST http://localhost:3000/api/variants/<variantId>/regenerate
```

## Mappa della repo

```
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
public/                UI: index.html, app.js (Preact + htm), styles.css
test/                  test di integrazione via app.handle(Request)
scripts/               db-reset.ts, gen-sample.ts
docs/                  SPEC, ADR, ai-log, prompt-log, report del giudice, campioni, cheat sheet di Elysia
.claude/agents/        agent di progetto (prompt-engineer, channel-judge, assessment-docs)
data/gyver.db          DB SQLite già popolato
```
