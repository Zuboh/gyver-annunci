# Architettura

Termini come in [`GLOSSARY.md`](GLOSSARY.md). Decisioni in [`docs/adr/`](docs/adr/). Contratto completo in [`docs/SPEC.md`](docs/SPEC.md).

## Frontend vs Backend

| | Backend ([`backend/`](backend/)) | Frontend ([`frontend/`](frontend/)) |
|---|---|---|
| Cosa contiene | API HTTP, casi d'uso, generazione LLM, validazione, DB SQLite, test e script | UI per elencare, creare e modificare gli Annunci, con l'anteprima per Canale |
| Tecnologia | TypeScript su Bun, Elysia, `bun:sqlite`, Zod, SDK OpenAI | Preact + htm da CDN (`esm.sh`, versione fissata), moduli ES, CSS semplice |
| Build | Nessuna: Bun esegue il TypeScript | Nessuna: il browser carica i moduli così come sono |
| Come parte | `bun run dev` avvia [`backend/src/server.ts`](backend/src/server.ts) | La serve lo stesso processo: `/` restituisce `index.html`, il resto sta sotto `/assets/` |
| Come si parlano | Espone `/api/*` in JSON, errori nella forma `{ error: { code, message, details } }` | Chiama `/api/*` solo da [`frontend/lib/api.js`](frontend/lib/api.js) |
| Test | 81 test di integrazione in [`backend/test/`](backend/test/) | Nessun test automatico; verifica manuale nel browser |
| Guida | [`backend/README.md`](backend/README.md) | [`frontend/README.md`](frontend/README.md) |

## Come è diviso il progetto

Un solo processo Bun serve l'API (Elysia) e la pagina statica. Il codice è diviso per responsabilità, non per strato tecnico:

| Modulo | Responsabilità | Perché separato |
|---|---|---|
| [`backend/src/app.ts`](backend/src/app.ts) | `createApp({ db, llm })`: route, `onError` uniforme, file statici | È l'**unico seam** dei test: DB in memoria e `FakeLlmClient` entrano da qui. |
| [`backend/src/http/`](backend/src/http/) | Route per area e `AppError` (codice, stato HTTP, messaggio italiano) | Le route validano l'input con TypeBox e delegano. Non contengono logica. |
| [`backend/src/ads/`](backend/src/ads/) | Casi d'uso degli Annunci e repository SQL esplicito | Qui stanno le regole di persistenza (transazioni, Versioni append-only). |
| [`backend/src/generation/`](backend/src/generation/) | Brief (riuso o creazione) → contenuto → validazione → retry, con `generation_runs` | Orchestrazione LLM indipendente dall'HTTP: la usano anche gli script. |
| [`backend/src/llm/`](backend/src/llm/) | `LlmClient` (2 operazioni), client OpenAI, client finto, prompt versionati | L'unico punto in cui cambia il fornitore LLM. |
| [`backend/src/validation/`](backend/src/validation/) | `validateContent(contenuto, contesto)` | **Una sola** validazione per l'output LLM e per le Versioni manuali. |
| [`backend/src/domain/`](backend/src/domain/) | Tipi e schemi Zod (Brief, contenuto per tipo di canale, Creative) | Lo stesso schema vincola OpenAI e valida i contenuti. |
| [`backend/src/catalog/`](backend/src/catalog/), [`backend/src/db/`](backend/src/db/) | Canali e Formati dal DB; schema SQL e seed | I Canali sono dati (ADR 0001). |
| [`frontend/`](frontend/) | UI Preact + htm senza build | Modulo opzionale della traccia, servito dallo stesso server. |

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

Schema in [`backend/src/db/schema.sql`](backend/src/db/schema.sql). Le scelte principali:

- **Canali e Formati sono dati, la forma del contenuto è codice** ([ADR 0001](docs/adr/0001-canali-come-dati-schema-nel-codice.md)). `channels.kind` sceglie uno dei tre schemi Zod in [`backend/src/domain/content-schemas.ts`](backend/src/domain/content-schemas.ts) e il prompt del tipo. `channel_formats.constraints` contiene `maxLength` e `maxItems` per percorso (`sections.*.bullets.*`), i campi obbligatori e la dimensione dell'immagine. LinkedIn come job board si aggiunge con due righe di seed, senza migrazioni. Un tipo di canale nuovo richiede schema e prompt, che servirebbero comunque.
- **Un Annuncio è una combinazione Canale × Formato × Luogo.** Lo stesso lavoro su un'altra città o in un altro formato è un altro Annuncio, quindi ha i suoi Stati e le sue metriche. La FK composta `ads(channel_id, format) → channel_formats` rende impossibile salvare una combinazione non ammessa. L'API la controlla prima e risponde 422 `CHANNEL_FORMAT_NOT_ALLOWED`.
- **Il Luogo è un valore dell'Annuncio, non un'entità**: un'etichetta pubblica libera ("Orzinuovi (BS) + trasferte") più comune, provincia, sigla, regione e paese. Il default viene dalla sede della Job Offer, ma senza via ([`locationFromJobOffer`](backend/src/ads/ad-use-cases.ts)).
- **La Variante tiene insieme testo e Creative.** Il test A/B confronta messaggi (Angoli), non combinazioni copy × immagine. La Creative è una descrizione strutturata (overlay, `highlightWord`, soggetto della foto, dimensioni), non un file.
- **Le Versioni sono immutabili** ([ADR 0002](docs/adr/0002-versioni-immutabili.md)). Ogni generazione o modifica manuale aggiunge una riga. Le Versioni `llm` portano `brief_id`, `model` e `prompt_version`; quelle `manual` non ne hanno. Un `CHECK` impone la coerenza tra Origine e provenienza. I trigger SQL vietano UPDATE e DELETE su `versions` e DELETE su `variants` e `ads`: si scarta e si archivia, non si cancella. Così resta sempre visibile cosa ha scritto l'LLM e cosa ha corretto il team, ed è il dato che serve per migliorare i prompt.
- **Il Brief è un passaggio intermedio salvato** ([ADR 0003](docs/adr/0003-brief-come-passaggio-intermedio.md)). Uno per Job Offer, riusato da tutti i suoi Annunci, con fatti coerenti tra canali. È l'unico prompt che vede la Job Offer grezza. Tiene la lista `doNotSay` dei dati da non pubblicare, che resta nel Brief e non arriva ai prompt di canale.
- **Un Angolo per Variante attiva.** Il codice rifiuta un Angolo già attivo (400), sia quando si aggiunge una Variante sia quando se ne ripristina una. L'indice unico parziale `variants_active_angle` su `(ad_id, lower(trim(angle))) WHERE active = 1` fa da rete di sicurezza.
- **Un Annuncio archiviato è congelato.** Rigenerare, aggiungere Varianti, salvare Versioni manuali, scartare o ripristinare risponde 422 `AD_ARCHIVED` finché lo Stato non cambia. `ready` e `published` richiedono almeno una Variante attiva (422 `AD_HAS_NO_ACTIVE_VARIANT`). Le altre transizioni restano libere.
- **`generation_runs`** registra ogni tentativo LLM (`ok` / `invalid` / `error`, issue, risposta grezza), anche quando non si salva nulla. Il `runId` torna nel 502.

## Flusso dei dati

`POST /api/ads` con `{ job_offer_id, channel, format, angles[1..3], location? }`:

1. **Route** ([`ads-routes.ts`](backend/src/http/ads-routes.ts)): TypeBox valida il corpo; se non è valido risponde 400 con `details.issues`.
2. **Caso d'uso** ([`ad-use-cases.ts`](backend/src/ads/ad-use-cases.ts) `createAd`): Job Offer esistente, combinazione ammessa (altrimenti 422) e Angoli distinti. Poi chiede **prima** il Brief: se fallisce non si salva niente.
3. **Brief** ([`generation-service.ts`](backend/src/generation/generation-service.ts) `getOrCreateBrief`): riusa l'ultimo Brief, oppure lo genera con `briefPrompt` sul payload della Job Offer. Una mappa delle creazioni in corso evita due Brief paralleli per la stessa Job Offer. Un Brief che porta condizioni interne in `companyPitch`, `benefits`, `sellingPoints` o `travel` è scartato e ritentato.
4. L'Annuncio in `draft` viene preparato **in memoria**. Il suo id etichetta i tentativi, poi le Varianti vengono generate **in parallelo** (`Promise.allSettled`).
5. **Contenuto** (`generateVariantContent`): il prompt del tipo di canale riceve Brief, Canale, linee guida di tono, vincoli, Angolo e Luogo, mai la Job Offer. Il Brief arriva **senza `doNotSay`**, e ai canali non job board anche con `siteAddress: null`.
6. **LLM** ([`openai-llm-client.ts`](backend/src/llm/openai-llm-client.ts)): Chat Completions con `zodResponseFormat` (structured outputs strict) e `JSON.parse` manuale, che conserva il testo grezzo.
7. **Validazione** ([`validate-content.ts`](backend/src/validation/validate-content.ts)), nell'ordine: schema del tipo di canale → vincoli del Formato di Canale → Creative presente solo nei formati con immagine e della misura giusta → regole di business ([`business-rules.ts`](backend/src/validation/business-rules.ts)): nessun indirizzo esatto fuori da Indeed e cifre dentro la RAL della Job Offer. Per l'output LLM valgono in più la forma della retribuzione, la condizione dell'indennità, nessuna condizione interna e nessun link, email o telefono. Il contesto di validazione porta `origin` e, per l'output LLM, il Brief di partenza, così il controllo delle condizioni interne conosce le citazioni di `doNotSay`.
8. Se non è valido, **un retry** con le issue nel prompt. Al secondo fallimento risponde 502 con `runId`. Senza chiave o con OpenAI irraggiungibile risponde 503.
9. **Creazione atomica**: si genera prima, poi l'Annuncio e le Varianti riuscite, ciascuna con la prima Versione `llm`, si scrivono in **una transazione** sincrona. La transazione sta fuori dalle chiamate LLM perché quelle di `bun:sqlite` devono essere sincrone. **Se tutti gli Angoli falliscono non si salva nulla** e torna il primo errore (502 o 503).
10. La risposta è `201 { ad, failedAngles }`, con `failedAngles` non vuoto se una parte degli Angoli è fallita. La UI ([`frontend/components/`](frontend/components/)) apre il dettaglio e disegna l'anteprima del canale dalla Versione corrente.

La modifica manuale (`PUT /api/variants/:id/content`) passa dallo stesso `validateContent` con `origin: 'manual'` e risponde 422 `INVALID_CONTENT` con `details.issues[{ path, message }]`.

## Semplificazioni a cui badare

- **Una sola Job Offer** (`jo_001`), caricata dal seed: non si gestiscono Job Offer.
- **Nessuna immagine**: la Creative è una descrizione con anteprima HTML.
- **Nessuna pubblicazione reale** e nessuna metrica delle Varianti: lo Stato si cambia a mano, con le sole guardie descritte sopra.
- **Validazione euristica**: indirizzo, cifre, condizioni interne e contatti sono riconosciuti con regex tarate sulla forma di `jo_001`. Le regole di sicurezza valgono solo per l'output LLM.
- **Nessuna autenticazione**: il server ascolta su `127.0.0.1` per default, e nessuna modifica è attribuita a una persona.
- **I tentativi di generazione non sono esposti dall'API**: si leggono nel DB.
- Gli altri limiti sono in [tradeoffs.md](tradeoffs.md).
