# Prompt

La pipeline ha due passi ([ADR 0003](docs/adr/0003-brief-come-passaggio-intermedio.md)): **Job Offer → Brief → contenuto per Canale**. I quattro prompt sono in [`src/llm/prompts/`](src/llm/prompts/) e sono versionati insieme. La versione finale è **v5** (`brief@v5`, `job_board@v5`, `social_ad@v5`, `messaging@v5`). L'identificatore del prompt è salvato su ogni Brief e su ogni Versione `llm`. Storia completa in [`docs/prompt-log.md`](docs/prompt-log.md), campioni in [`docs/samples/`](docs/samples/).

## Versione finale

| Prompt | File | Riceve | Produce |
|---|---|---|---|
| Brief | [`brief.ts`](src/llm/prompts/brief.ts) | Il payload JSON della Job Offer: è l'unico prompt che la vede | `briefContentSchema` ([`brief-schema.ts`](src/domain/brief-schema.ts)) |
| Job board (Indeed) | [`job-board.ts`](src/llm/prompts/job-board.ts) | Il messaggio di variante (sotto) | `jobBoardContentSchema` |
| Social (Instagram, TikTok) | [`social-ad.ts`](src/llm/prompts/social-ad.ts) | Il messaggio di variante | `socialAdContentSchema` |
| Messaggistica (WhatsApp) | [`messaging.ts`](src/llm/prompts/messaging.ts) | Il messaggio di variante | `messagingContentSchema` |

**Brief.** Il ruolo è un recruiter senior di Gyver. Usa solo fatti scritti nella Job Offer, senza deduzioni ("ambiente internazionale", "crescita professionale"). Istruzioni per ogni campo:

- `companyName` identico alla Job Offer;
- `salary` con i numeri esatti;
- `responsibilities` alla seconda persona del presente;
- `benefits` con cifra **e** condizione;
- `travel` neutro;
- `workArea` senza via;
- `siteAddress` solo per le job board;
- `suggestedAngles`: 3 nomi di 1-2 parole, scelti **prima** dei `sellingPoints`, con `sellingPoints[i]` che sostiene `suggestedAngles[i]`;
- `doNotSay`: rilegge riga per riga retribuzione, benefit, trasferte e orari, e ogni voce cita tra virgolette il testo della Job Offer da cui viene.

**Prompt di canale.** Un system prompt per tipo di canale e le stesse `commonRules` ([`variant-context.ts`](src/llm/prompts/variant-context.ts)):

- si parla a nome di Gyver, l'azienda in terza persona, dando del tu al candidato esperto;
- solo fatti del Brief, nessuna promessa generica, mai le voci di `doNotSay`;
- la retribuzione solo in tre forme: "RAL da <min> a <max> €", "RAL fino a <max> €", "RAL da <min> €";
- i benefit con la condizione completa, o non citati;
- il messaggio costruito sull'Angolo indicato;
- niente markdown;
- è meglio un testo corto che uno troncato.

Ogni tipo aggiunge la propria struttura:

- **Indeed**: 4 sezioni nell'ordine dell'esempio del PDF; titolo "ruolo: specifica in chiave Angolo"; bullet come frasi complete con il punto; la via solo nel campo `address`.
- **Social**: overlay con il ruolo nella riga 1 e Angolo + fatto nella riga 2; la RAL negli overlay solo con l'Angolo stipendio; `highlightWord` di una sola parola presente negli overlay; caption che apre sull'Angolo; TikTok parlato e al tu; hashtag diversi dal nome dell'Angolo; massimo 3 emoji.
- **WhatsApp**: titolo e primo badge sul fatto dell'Angolo e su nessun altro; Luogo e trasferte in un solo badge; sezioni nell'ordine dell'esempio; nessuna emoji.

**Messaggio di variante** (`variantUserMessage`): Angolo, Luogo da mostrare, Canale con le linee guida di tono (dal DB), vincoli del Formato di Canale in testo e Brief in JSON. Ai canali non job board arriva con `siteAddress: null`. Per i campi fino a 300 caratteri i vincoli chiedono un obiettivo di circa 2/3 del massimo con un budget di parole, perché il modello sfora i limiti in caratteri e conta meglio le parole. Al retry si aggiunge "## Correzioni richieste" con le issue del tentativo precedente.

## Perché esiste `doNotSay`

La Job Offer contiene condizioni vere ma sfavorevoli o interne: le trasferte giornaliere senza indennità e le ore di viaggio oltre le 8 pagate all'85%. Pubblicarle danneggia l'annuncio, e lasciarle implicite non basta, perché un modello che riassume tende a riportarle. Il Brief le rende **esplicite**, e i prompt di canale, che non vedono mai la Job Offer, ricevono un divieto puntuale. La lista serve anche al giudice, che cerca quelle stringhe nei campioni. Il codice però non la controlla: blocca solo l'indirizzo esatto e le cifre della retribuzione.

## Come il modello è vincolato

1. **Structured outputs strict.** Lo schema Zod del tipo di canale passa a OpenAI con `zodResponseFormat` ([`openai-llm-client.ts`](src/llm/openai-llm-client.ts)). Tutti i campi sono obbligatori e gli "opzionali" sono `.nullable()`, perché il modo strict rifiuta `.optional()`.
2. **`chat.completions.create` + `JSON.parse` manuale**, non `.parse()`. `.parse()` lancia un'eccezione su un output non conforme e perde il testo grezzo. Così ogni risposta arriva al servizio di generazione, che la valida, la salva in `generation_runs.raw_response` e la usa per il retry. Un rifiuto, un `finish_reason` diverso da `stop` o un testo non JSON diventano `content: null`: è un tentativo non valido, non un'eccezione.
3. **Validazione nel codice** ([`validate-content.ts`](src/validation/validate-content.ts)), perché lo schema JSON non esprime tutto:
   - **schema** del tipo di canale (Zod, messaggi in italiano);
   - **vincoli del Formato di Canale** dal DB: `maxLength` e `maxItems` per percorso, campi obbligatori, Creative presente solo con l'immagine e con width e height esatti, `highlightWord` di una parola presente come parola intera negli overlay;
   - **regole di business** ([`business-rules.ts`](src/validation/business-rules.ts)): nessun indirizzo esatto fuori da Indeed e ogni cifra di retribuzione dentro la RAL della Job Offer. Solo per l'output LLM, anche la forma della retribuzione (niente "RAL da 38.000 €" quando 38.000 è il massimo) e l'indennità con la sua condizione ("a notte", "più giorni"), ricavata dalla Job Offer.

## Quando la risposta non è conforme

[`generation-service.ts`](src/generation/generation-service.ts) `withRetry`:

- ogni tentativo è una riga di `generation_runs` con esito `ok`, `invalid` o `error`, le issue e la risposta grezza;
- **1 retry** (`MAX_ATTEMPTS = 2`): per le Varianti le issue tornano nel prompt come `previousIssues`, mentre il Brief riprova senza feedback;
- al secondo fallimento non si salva nulla e la risposta è **502 `GENERATION_FAILED`** con `details.runId`;
- chiave assente, rete, 401/403, modello inesistente, 429 o 5xx diventano **503 `LLM_UNAVAILABLE`**, con il tentativo registrato come `error`;
- nella creazione con più Angoli una Variante fallita non annulla le altre: la risposta è `201` con `failedAngles[{ angle, error }]`.

I test coprono retry poi successo, sempre non valido → 502, rete → 503 e indirizzo su social → retry o 502 ([`test/generation-errors.test.ts`](test/generation-errors.test.ts), [`test/validation-rules.test.ts`](test/validation-rules.test.ts)).

## Storia delle versioni

Campioni: `bun run gen:sample` su `jo_001`, uno per ciascuno dei 6 Formati di Canale, `gpt-4o-mini-2024-07-18`. Un campione passa al "primo tentativo" quando il primo run è `ok`, senza retry.

| Canale × Formato | v1 | v2 | v3 | v4 | v5 |
|---|---|---|---|---|---|
| indeed-text | ok | ok | ok | ok | ok |
| instagram-image | retry (highlightWord) | ok | ok | ok | ok |
| instagram-image_text | ok | ok | ok | ok | ok |
| tiktok-image | ok | fallito anche al retry (caption 166 → 200/150) | retry (157/150) | ok | ok |
| whatsapp-image_text | ok | ok | ok | retry (highlightWord) | ok |
| whatsapp-text | ok | ok | ok | ok | ok |
| **Primo tentativo** | 5/6 | 5/6 | 5/6 | 5/6 | **6/6** |

| Versione | Cosa non funzionava | Cosa è cambiato |
|---|---|---|
| v1 | `doNotSay` copiato dall'esempio del prompt e senza la condizione vera; "AB Group" invece di "AB Group SpA"; promesse inventate ("crescita professionale"); l'azienda in prima persona; "RAL 32-38k€"; hashtag con lo spazio | Baseline |
| v2 | Caption TikTok oltre 150 caratteri; via nella descrizione Indeed; `highlightWord` come frase; nessun sellingPoint per "carriera" | `companyName` nel Brief; tolto l'esempio da `doNotSay`; `travel` neutro; regole comuni (terza persona, RAL estesa, niente markdown); struttura Indeed e WhatsApp dal PDF |
| v3 | TikTok ancora 157/150; `doNotSay` vuoto per la scappatoia "lascia vuota"; "Inizia la tua carriera" a un tecnico con 3-5 anni | Budget di parole sui campi corti; sede = Luogo su Indeed; un sellingPoint per Angolo |
| v4 | `highlightWord` assente dagli overlay su WhatsApp; Angoli come temi ("dimensione dell'azienda"), "carriera" sparito; overlay "RAL da 38.000 €"; bullet con la virgola. **Il giudice respinge whatsapp-image_text con Fedeltà 0**: "Indennità di 60 € per le trasferte" generalizza un'indennità prevista solo a notte nelle trasferte di più giorni ([`docs/judge-report-v4.md`](docs/judge-report-v4.md)) | Obiettivo a 2/3 del limite; `doNotSay` con la citazione; titolo Indeed in chiave Angolo |
| v5 | Vedi i limiti sotto | `suggestedAngles` prima di `sellingPoints` e allineati; benefit con la condizione; tre forme di retribuzione; primo badge sull'Angolo; overlay senza i fatti degli altri Angoli; TikTok parlato. **Validazione più severa nel codice**: condizione dell'indennità, forma della retribuzione, `highlightWord` di una parola e a parola intera |

La lezione di v1-v4: le regole che il modello sbaglia in modo ripetuto, come `highlightWord` o la forma della RAL, si chiudono nel codice, non con altre istruzioni nel prompt.

## Limiti noti di v5

- **Errori di italiano**: "Effetti sopralluoghi" invece di "Effettui", nel Brief e nei testi che lo riprendono; "Coordina attività" mescola le persone verbali; "Lavora all'internazionale"; "in cantiera".
- **`#carriera`** nella Variante TikTok sull'Angolo carriera ripete il nome dell'Angolo.
- **La RAL negli overlay** di Varianti non sullo stipendio (TikTok carriera, Instagram internazionale), nonostante la regola.
- "a notte" perso in un badge WhatsApp: la regola chiede almeno una delle condizioni dell'indennità, non tutte.

Le regole "hashtag diverso dall'Angolo" e "RAL negli overlay solo con l'Angolo stipendio" sono solo nel prompt: con gpt-4o-mini servirebbe un controllo nel codice.
