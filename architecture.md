# Architettura

Termini come in [`GLOSSARY.md`](GLOSSARY.md). Decisioni in [`docs/adr/`](docs/adr/). Contratto completo in [`docs/SPEC.md`](docs/SPEC.md).

## Come è diviso il progetto

Un solo processo Bun serve l'API (Elysia) e la pagina statica. Il codice è diviso per responsabilità, non per strato tecnico:

| Modulo | Responsabilità | Perché separato |
|---|---|---|
| [`src/app.ts`](src/app.ts) | `createApp({ db, llm })`: route, `onError` uniforme, file statici | È l'**unico seam** dei test: DB in memoria e `FakeLlmClient` entrano da qui. |
| [`src/http/`](src/http/) | Route per area e `AppError` (codice, stato HTTP, messaggio italiano) | Le route validano l'input con TypeBox e delegano. Non contengono logica. |
| [`src/ads/`](src/ads/) | Casi d'uso degli Annunci e repository SQL esplicito | Qui stanno le regole di persistenza (transazioni, Versioni append-only). |
| [`src/generation/`](src/generation/) | Brief (riuso o creazione) → contenuto → validazione → retry, con `generation_runs` | Orchestrazione LLM indipendente dall'HTTP: la usano anche gli script. |
| [`src/llm/`](src/llm/) | `LlmClient` (2 operazioni), client OpenAI, client finto, prompt versionati | L'unico punto in cui cambia il fornitore LLM. |
| [`src/validation/`](src/validation/) | `validateContent(contenuto, contesto)` | **Una sola** validazione per l'output LLM e per le Versioni manuali. |
| [`src/domain/`](src/domain/) | Tipi e schemi Zod (Brief, contenuto per tipo di canale, Creative) | Lo stesso schema vincola OpenAI e valida i contenuti. |
| [`src/catalog/`](src/catalog/), [`src/db/`](src/db/) | Canali e Formati dal DB; schema SQL e seed | I Canali sono dati (ADR 0001). |
| [`public/`](public/) | UI Preact + htm senza build | Modulo opzionale della traccia, servito dallo stesso server. |

## Modello dati

```
JobOffer (input, sola lettura)
 ├── Brief            1 in uso per Job Offer (l'ultimo); si rigenera, non si modifica
 └── Ad               1 Canale × 1 Formato × 1 Luogo, con uno Stato
      └── Variant     1 Angolo, etichetta A/B/C…, attiva o scartata; testo + Creative insieme
           └── Version  immutabile, numero progressivo, Origine llm|manual; corrente = numero più alto

Channel (kind: job_board | social_ad | messaging)
 └── ChannelFormat    (channel_id, format) ammessi, con i vincoli in JSON
```

Schema in [`src/db/schema.sql`](src/db/schema.sql). Le scelte principali:

- **Canali e Formati sono dati, la forma del contenuto è codice** ([ADR 0001](docs/adr/0001-canali-come-dati-schema-nel-codice.md)). `channels.kind` sceglie uno dei tre schemi Zod in [`src/domain/content-schemas.ts`](src/domain/content-schemas.ts) e il prompt del tipo. `channel_formats.constraints` contiene `maxLength` e `maxItems` per percorso (`sections.*.bullets.*`), i campi obbligatori e la dimensione dell'immagine. LinkedIn come job board si aggiunge con due righe di seed, senza migrazioni. Un tipo di canale nuovo richiede schema e prompt, che servirebbero comunque.
- **Un Annuncio è una combinazione Canale × Formato × Luogo.** Lo stesso lavoro su un'altra città o in un altro formato è un altro Annuncio, quindi ha i suoi Stati e le sue metriche. La FK composta `ads(channel_id, format) → channel_formats` rende impossibile salvare una combinazione non ammessa. L'API la controlla prima e risponde 422 `CHANNEL_FORMAT_NOT_ALLOWED`.
- **Il Luogo è un valore dell'Annuncio, non un'entità**: un'etichetta pubblica libera ("Orzinuovi (BS) + trasferte") più comune, provincia, sigla, regione e paese. Il default viene dalla sede della Job Offer, ma senza via ([`locationFromJobOffer`](src/ads/ad-use-cases.ts)).
- **La Variante tiene insieme testo e Creative.** Il test A/B confronta messaggi (Angoli), non combinazioni copy × immagine. La Creative è una descrizione strutturata (overlay, `highlightWord`, soggetto della foto, dimensioni), non un file.
- **Le Versioni sono immutabili** ([ADR 0002](docs/adr/0002-versioni-immutabili.md)). Ogni generazione o modifica manuale aggiunge una riga. Le Versioni `llm` portano `brief_id`, `model` e `prompt_version`; quelle `manual` non ne hanno. Un `CHECK` impone la coerenza tra Origine e provenienza. I trigger SQL vietano UPDATE e DELETE su `versions` e DELETE su `variants` e `ads`: si scarta e si archivia, non si cancella. Così resta sempre visibile cosa ha scritto l'LLM e cosa ha corretto il team, ed è il dato che serve per migliorare i prompt.
- **Il Brief è un passaggio intermedio salvato** ([ADR 0003](docs/adr/0003-brief-come-passaggio-intermedio.md)). Uno per Job Offer, riusato da tutti i suoi Annunci, con fatti coerenti tra canali. È l'unico prompt che vede la Job Offer grezza. Tiene la lista `doNotSay` dei dati da non pubblicare.
- **`generation_runs`** registra ogni tentativo LLM (`ok` / `invalid` / `error`, issue, risposta grezza), anche quando non si salva nulla. Il `runId` torna nel 502.

## Flusso dei dati

`POST /api/ads` con `{ job_offer_id, channel, format, angles[1..3], location? }`:

1. **Route** ([`ads-routes.ts`](src/http/ads-routes.ts)): TypeBox valida il corpo; se non è valido risponde 400 con `details.issues`.
2. **Caso d'uso** ([`ad-use-cases.ts`](src/ads/ad-use-cases.ts) `createAd`): Job Offer esistente, combinazione ammessa (altrimenti 422) e Angoli distinti. Poi chiede **prima** il Brief: se fallisce non si salva niente.
3. **Brief** ([`generation-service.ts`](src/generation/generation-service.ts) `getOrCreateBrief`): riusa l'ultimo Brief, oppure lo genera con `briefPrompt` sul payload della Job Offer. Una mappa delle creazioni in corso evita due Brief paralleli per la stessa Job Offer.
4. Si inserisce l'Annuncio in `draft`, poi le Varianti vengono generate **in parallelo** (`Promise.allSettled`).
5. **Contenuto** (`generateVariantContent`): il prompt del tipo di canale riceve Brief, Canale, linee guida di tono, vincoli, Angolo e Luogo, mai la Job Offer. Ai canali non job board arriva il Brief con `siteAddress: null`.
6. **LLM** ([`openai-llm-client.ts`](src/llm/openai-llm-client.ts)): Chat Completions con `zodResponseFormat` (structured outputs strict) e `JSON.parse` manuale, che conserva il testo grezzo.
7. **Validazione** ([`validate-content.ts`](src/validation/validate-content.ts)), nell'ordine: schema del tipo di canale → vincoli del Formato di Canale → Creative presente solo nei formati con immagine e della misura giusta → regole di business ([`business-rules.ts`](src/validation/business-rules.ts)): nessun indirizzo esatto fuori da Indeed, cifre dentro la RAL della Job Offer e, solo per l'output LLM, forma della retribuzione e condizione dell'indennità.
8. Se non è valido, **un retry** con le issue nel prompt. Al secondo fallimento risponde 502 con `runId`. Senza chiave o con OpenAI irraggiungibile risponde 503.
9. Variante e prima Versione `llm` sono scritte in **una transazione** sincrona, fuori dalla chiamata LLM perché le transazioni di `bun:sqlite` devono essere sincrone.
10. La risposta è `201 { ad, failedAngles }`. La UI ([`public/app.js`](public/app.js)) apre il dettaglio e disegna l'anteprima del canale dalla Versione corrente.

La modifica manuale (`PUT /api/variants/:id/content`) passa dallo stesso `validateContent` con `origin: 'manual'` e risponde 422 `INVALID_CONTENT` con `details.issues[{ path, message }]`.

## Semplificazioni a cui badare

- **Una sola Job Offer** (`jo_001`), caricata dal seed: non si gestiscono Job Offer.
- **Nessuna immagine**: la Creative è una descrizione con anteprima HTML.
- **Nessuna pubblicazione reale** e nessuna metrica delle Varianti: lo Stato si cambia a mano e non ci sono controlli sulle transizioni.
- **`doNotSay` è rispettato solo dal prompt.** Il codice blocca solo l'indirizzo esatto e le cifre della retribuzione, non le altre condizioni interne.
- **Validazione euristica**: l'indirizzo e le cifre sono riconosciuti con regex, tarate sulla forma di `jo_001`.
- **Nessuna autenticazione** e nessuna attribuzione delle modifiche a una persona.
- **I tentativi di generazione non sono esposti dall'API**: si leggono nel DB.
- Gli altri limiti sono in [tradeoffs.md](tradeoffs.md).
