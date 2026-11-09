# Tradeoff

## Linguaggio e struttura

- **TypeScript su Bun.** Un solo runtime fa da server, test runner (`bun test`), driver SQLite (`bun:sqlite`) e gestore di pacchetti, ed esegue TypeScript senza build. Chi valuta installa Bun e lancia quattro comandi.
- **Elysia fissato a `1.4.31`, non 2.0.** Il giorno del setup il tag `latest` di npm puntava a `2.0.0-rc.4`, una riscrittura appena uscita. La 1.4 è l'ultima stabile ed è quella documentata nel cheat sheet ([`docs/research/elysia-bun.md`](docs/research/elysia-bun.md)). Tutte le dipendenze hanno la versione esatta in [`package.json`](package.json). Serve **Bun ≥ 1.2** (peer `@types/bun >= 1.2.0` di Elysia 1.4.31); il progetto è testato con Bun 1.4.4.
- **SQL esplicito, niente ORM.** Il modello dati è la parte più valutata, e [`schema.sql`](src/db/schema.sql) lo mostra con vincoli, FK composta e trigger leggibili.
- **Zod come unica fonte della forma.** Lo stesso schema vincola OpenAI (`zodResponseFormat`) e valida l'output LLM e le Versioni manuali. TypeBox (`t`) resta solo per gli input HTTP, che è il percorso nativo di Elysia.
- **UI senza build** (Preact + htm da `esm.sh` con versione fissata), servita dallo stesso server: nessuna seconda toolchain.
- **Divisione per responsabilità** (ads, generation, llm, validation, catalog) con un solo seam di test, `createApp({ db, llm })`. Dettagli in [architecture.md](architecture.md).

## Decisioni di modello (ADR)

- **Canali come dati, forma del contenuto nel codice** ([ADR 0001](docs/adr/0001-canali-come-dati-schema-nel-codice.md)). Un canale nuovo di un tipo noto si aggiunge con una riga. Uno schema JSON editabile nel DB avrebbe scollegato prompt e validazione.
- **Versioni immutabili** ([ADR 0002](docs/adr/0002-versioni-immutabili.md)) invece della sovrascrittura con un flag "modificato". Costa righe e tiene sempre separato ciò che ha scritto l'LLM da ciò che ha corretto il team.
- **Il Brief come passaggio intermedio salvato** ([ADR 0003](docs/adr/0003-brief-come-passaggio-intermedio.md)). È una chiamata LLM in più, ma i fatti restano coerenti tra canali e i dati interni non arrivano ai prompt di canale.

## Scelte tecniche

- **`chat.completions.create` invece di `.parse()`.** `.parse()` lancia `ZodError` su un output non conforme e perde il testo grezzo. Con `create` + `zodResponseFormat` + `JSON.parse` ogni risposta arriva alla validazione, finisce in `generation_runs` e alimenta il retry ([`openai-llm-client.ts`](src/llm/openai-llm-client.ts)). Si rinuncia al tipo inferito dall'SDK, ma la validazione Zod a valle lo ricostruisce.
- **Niente generazione di immagini.** La Variante ha una **Creative**: overlay, parola evidenziata, soggetto della foto e dimensioni, resa come anteprima HTML. Generare il file avrebbe aggiunto un secondo fornitore, costi e tempi, senza toccare il modello dati. La traccia valuta il contenuto e il formato.
- **Fallimento parziale = `201` con `failedAngles`.** Con più Angoli, l'Annuncio e le Varianti riuscite restano salvati e la risposta elenca gli Angoli falliti con lo stesso corpo d'errore dell'API. Un 502 avrebbe buttato via il lavoro riuscito. Se fallisce il Brief, invece, non si salva nulla.
- **Errori di validazione dell'input → 400**, come da SPEC, non il 422 di default di Elysia. Il 422 resta per "combinazione non ammessa" e "contenuto non conforme".
- **Le regole sulla forma della retribuzione e sulla condizione dell'indennità valgono solo con `origin = 'llm'`** ([`validate-content.ts`](src/validation/validate-content.ts)). Gli esempi del PDF nel seed dicono "RAL iniziale da €38'000 + indennità", e applicarle anche alle Versioni manuali avrebbe reso il seed non valido. Una modifica manuale è una scelta editoriale e ne risponde chi la fa. Le regole su indirizzo, cifre fuori range e vincoli del formato valgono per tutti.
- **I limiti di lunghezza sono scelte editoriali**, non i limiti delle piattaforme: caption Instagram 2200, TikTok 150, badge WhatsApp 50, bullet Indeed 250. Sono dati in `channel_formats` ([`seed-data.ts`](src/db/seed-data.ts)), quindi si cambiano senza codice.

## Interpretazione delle parti ambigue

- **"Luogo"**: è dell'Annuncio, non della Job Offer. Ha un'etichetta libera e i dati geografici, con il default preso dalla sede ma senza via. La stessa posizione su un'altra città è un altro Annuncio.
- **"Varianti"**: alternative di messaggio (Angoli) per un test A/B. Testo e Creative stanno insieme: niente matrice copy × immagine.
- **Formati ammessi per canale**: Indeed solo testo; Instagram immagine e immagine+testo; TikTok solo immagine (9:16); WhatsApp immagine+testo (A4) e testo. Tutto è nel seed e si cambia con i dati.
- **Esempi del PDF**: sono nel seed come Annunci pubblicati con una Versione `manual`, perché li ha scritti una persona. Fanno da riferimento di tono per i prompt e per il giudice.
- **Indirizzo esatto**: ammesso solo nel campo `address` delle job board, come nell'esempio Indeed. Altrove solo l'area.

## Sacrificato per scope e tempo

- Gestione delle Job Offer: c'è solo `jo_001`, dal seed.
- Pubblicazione reale, sincronizzazione degli Stati e metriche delle Varianti.
- Autenticazione e attribuzione delle modifiche.
- **UI**: il contenuto si modifica **solo come JSON**, senza editor a campi. **Il Brief non si vede.** Del Luogo si modifica solo l'etichetta. Il 502 non è stato provato dal vivo.
- I tentativi di generazione non sono esposti dall'API né dalla UI.

## Limiti tecnici noti

- **Nessun controllo sulle transizioni di Stato**: si passa da `archived` a `draft` o da `draft` a `published` liberamente.
- **Niente impedisce di rigenerare o aggiungere Varianti a un Annuncio archiviato** (`regenerateVariant` e `addVariant` in [`ad-use-cases.ts`](src/ads/ad-use-cases.ts) non guardano lo Stato).
- **Uno stipendio mensile viene confrontato con la RAL.** `salaryIssues` tratta ogni cifra in € ≥ 1.000 come annuale, quindi "2.500 € al mese" risulta fuori range ([`business-rules.ts`](src/validation/business-rules.ts)).
- **`generation_runs.attempt` riparte da 1 a ogni chiamata.** Le rigenerazioni della stessa Variante hanno tutte attempt 1-2 e `ref` è l'Annuncio, non la Variante, quindi i tentativi di chiamate diverse si distinguono solo per data.
- **`GET /` tiene un Content-Length vecchio dopo una modifica a `index.html`.** `file()` di Elysia legge la dimensione all'avvio, e nemmeno `bun --watch` se ne accorge: bisogna riavviare il server. In produzione non succede.
- **`doNotSay` è rispettato solo dal prompt**; l'indirizzo e la retribuzione sono riconosciuti con regex tarate su `jo_001`.
- La regola sull'indennità chiede **almeno una** delle condizioni, non tutte ("multi-giorno" senza "a notte" passa).
- Le regole "hashtag diverso dall'Angolo" e "RAL negli overlay solo con l'Angolo stipendio" sono solo nel prompt. Restano errori di italiano in v5 (vedi [prompts.md](prompts.md)).

## Con un giorno in più

In ordine di priorità:

1. **Applicare i risultati della code review e della security review** in corso.
2. **Una macchina a stati per lo Stato dell'Annuncio** e il blocco della generazione sugli Annunci archiviati.
3. **Portare nel codice le regole che oggi sono solo nel prompt**: hashtag diverso dall'Angolo, RAL negli overlay solo con l'Angolo stipendio, tutte le condizioni dell'indennità, voci di `doNotSay` cercate nel testo.
4. **Un giudice automatico** (rubrica di `agent-channel-judge`) su ogni generazione o in CI sui campioni, con un controllo grammaticale per errori come "Effetti" e "in cantiera".
5. **Una retribuzione con periodo** (annuale o mensile) nella Job Offer e nella validazione.
6. **`generation_runs` per operazione**: un id di operazione, `ref` alla Variante, e l'esposizione nell'API e nella UI.
7. **UI**: editor a campi per canale, vista del Brief con rigenerazione, modifica completa del Luogo.
8. **Rendering della Creative in PNG** da un template HTML, per avere un file pronto per il designer.
