# Tradeoff

## Linguaggio e struttura

- **TypeScript su Bun.** Un solo runtime fa da server, test runner (`bun test`), driver SQLite (`bun:sqlite`) e gestore di pacchetti, ed esegue TypeScript senza build. Chi valuta installa Bun e lancia quattro comandi.
- **Elysia fissato a `1.4.31`, non 2.0.** Il giorno del setup il tag `latest` di npm puntava a `2.0.0-rc.4`, una riscrittura appena uscita. La 1.4 è l'ultima stabile ed è quella documentata nel cheat sheet ([`docs/research/elysia-bun.md`](docs/research/elysia-bun.md)). Tutte le dipendenze hanno la versione esatta in [`package.json`](package.json). Serve **Bun ≥ 1.2** (peer `@types/bun >= 1.2.0` di Elysia 1.4.31); il progetto è testato con Bun 1.4.4.
- **SQL esplicito, niente ORM.** Il modello dati è la parte più valutata, e [`schema.sql`](backend/src/db/schema.sql) lo mostra con vincoli, FK composta e trigger leggibili.
- **Zod come unica fonte della forma.** Lo stesso schema vincola OpenAI (`zodResponseFormat`) e valida l'output LLM e le Versioni manuali. TypeBox (`t`) resta solo per gli input HTTP, che è il percorso nativo di Elysia.
- **UI senza build** (Preact + htm da `esm.sh` con versione fissata), servita dallo stesso server: nessuna seconda toolchain.
- **Divisione per responsabilità** (ads, generation, llm, validation, catalog) con un solo seam di test, `createApp({ db, llm })`. Dettagli in [architecture.md](architecture.md).

## Decisioni di modello (ADR)

- **Canali come dati, forma del contenuto nel codice** ([ADR 0001](docs/adr/0001-canali-come-dati-schema-nel-codice.md)). Un canale nuovo di un tipo noto si aggiunge con una riga. Uno schema JSON editabile nel DB avrebbe scollegato prompt e validazione.
- **Versioni immutabili** ([ADR 0002](docs/adr/0002-versioni-immutabili.md)) invece della sovrascrittura con un flag "modificato". Costa righe e tiene sempre separato ciò che ha scritto l'LLM da ciò che ha corretto il team.
- **Il Brief come passaggio intermedio salvato** ([ADR 0003](docs/adr/0003-brief-come-passaggio-intermedio.md)). È una chiamata LLM in più, ma i fatti restano coerenti tra canali e i dati interni non arrivano ai prompt di canale.

## Scelte tecniche

- **`chat.completions.create` invece di `.parse()`.** `.parse()` lancia `ZodError` su un output non conforme e perde il testo grezzo. Con `create` + `zodResponseFormat` + `JSON.parse` ogni risposta arriva alla validazione, finisce in `generation_runs` e alimenta il retry ([`openai-llm-client.ts`](backend/src/llm/openai-llm-client.ts)). Si rinuncia al tipo inferito dall'SDK, ma la validazione Zod a valle lo ricostruisce.
- **Niente generazione di immagini.** La Variante ha una **Creative**: overlay, parola evidenziata, soggetto della foto e dimensioni, resa come anteprima HTML. Generare il file avrebbe aggiunto un secondo fornitore, costi e tempi, senza toccare il modello dati. La traccia valuta il contenuto e il formato.
- **Fallimento parziale = `201` con `failedAngles`.** Con più Focus, l'Annuncio e le Varianti riuscite vengono salvati e la risposta elenca i Focus falliti con lo stesso corpo d'errore dell'API. Un 502 avrebbe buttato via il lavoro riuscito. Se falliscono il Brief o tutti i Focus, invece, non si salva nulla e la risposta è 502 o 503: un Annuncio senza Varianti non esiste.
- **Errori di validazione dell'input → 400**, come da SPEC, non il 422 di default di Elysia. Il 422 resta per "combinazione non ammessa" e "contenuto non conforme".
- **Le regole di formulazione e di sicurezza valgono solo con `origin = 'llm'`** ([`validate-content.ts`](backend/src/validation/validate-content.ts)). Sono la forma della retribuzione, la condizione dell'indennità, le condizioni interne e i contatti. Gli esempi del PDF nel seed dicono "RAL iniziale da €38'000 + indennità", e applicarle anche alle Versioni manuali avrebbe reso il seed non valido. Una modifica manuale è una scelta editoriale e ne risponde chi la fa: una persona può quindi scrivere a mano "senza indennità" o un numero di telefono. Le regole su indirizzo, cifre fuori range e vincoli del formato valgono per tutti.
- **I limiti di lunghezza sono scelte editoriali**, non i limiti delle piattaforme: caption Instagram 2200, TikTok 150, badge WhatsApp 50, bullet Indeed 250. Sono dati in `channel_formats` ([`seed-data.ts`](backend/src/db/seed-data.ts)), quindi si cambiano senza codice.

## Interpretazione delle parti ambigue

- **"Luogo"**: è dell'Annuncio, non della Job Offer. Ha un'etichetta libera e i dati geografici, con il default preso dalla sede ma senza via. La stessa posizione su un'altra città è un altro Annuncio.
- **"Varianti"**: alternative di messaggio (Focus) per un test A/B. Testo e Creative stanno insieme: niente matrice copy × immagine.
- **Formati ammessi per canale**: Indeed solo testo; Instagram immagine e immagine+testo; TikTok solo immagine (9:16); WhatsApp immagine+testo (A4) e testo. Tutto è nel seed e si cambia con i dati.
- **Esempi del PDF**: sono nel seed come Annunci pubblicati con una Versione `manual`, perché li ha scritti una persona. Fanno da riferimento di tono per i prompt e per il giudice.
- **Indirizzo esatto**: ammesso solo nel campo `address` delle job board, come nell'esempio Indeed. Altrove solo l'area.

## Sacrificato per scope e tempo

- Gestione delle Job Offer: c'è solo `jo_001`, dal seed.
- Pubblicazione reale, sincronizzazione degli Stati e metriche delle Varianti.
- **Autenticazione** e attribuzione delle modifiche. È uno strumento locale: il server ascolta su `127.0.0.1` per default, e con `HOST=0.0.0.0` chiunque in rete può leggere e modificare.
- **Migrazioni**: lo schema è applicato con `CREATE TABLE IF NOT EXISTS`, quindi una colonna nuova richiede `db:reset`.
- **UI**: il contenuto si modifica **solo come JSON**, senza editor a campi. **Il Brief non si vede.** Del Luogo si modifica solo l'etichetta. Il 502 non è stato provato dal vivo.
- I tentativi di generazione non sono esposti dall'API né dalla UI.

## Limiti tecnici noti

- **Transizioni di Stato libere, a parte due guardie**: un Annuncio archiviato è congelato (422 `AD_ARCHIVED`), e `ready`/`published` richiedono una Variante attiva. Per il resto si passa da uno Stato all'altro liberamente, anche uscendo da `archived`. La guardia vale solo quando si imposta lo Stato: **scartare l'ultima Variante attiva di un Annuncio pubblicato è ancora ammesso**.
- **Il Luogo resta modificabile su un Annuncio pubblicato** ([`ad-use-cases.ts`](backend/src/ads/ad-use-cases.ts) `updateAd`).
- **Gli errori OpenAI non mappati diventano 500.** Chiave, rete, 404, 429 e 5xx diventano 503; altri, per esempio un 400 dovuto a un errore di schema, finiscono nel 500 generico ([`openai-llm-client.ts`](backend/src/llm/openai-llm-client.ts)).
- **`generation_runs` non raggruppa i tentativi.** `attempt` riparte da 1 a ogni chiamata, `ref` è l'Annuncio e non la Variante, e manca un `request_id`: tentativi di chiamate diverse si distinguono solo per data. Inoltre `ref` può puntare a un Annuncio mai salvato, quando tutti i Focus falliscono, perché il riferimento è polimorfico e senza FK.
- **L'indice `variants_active_angle` usa `lower()` di SQLite, che è solo ASCII**, mentre il controllo nel codice usa `toLowerCase()`. Con lettere accentate in maiuscolo la rete di sicurezza del DB è più debole del codice.
- **CDN senza SRI**: Preact/htm da `esm.sh` (versione fissata) e Google Fonts sono caricati senza Subresource Integrity.
- **Validazione euristica**: indirizzo, retribuzione, condizioni interne e contatti sono riconosciuti con regex tarate su `jo_001`.
- **I prompt contengono i numeri di `jo_001`** (38.000 €, 1.700 dipendenti) come esempi: con un'altra Job Offer possono trascinare cifre sbagliate.
- La regola sull'indennità chiede **almeno una** delle condizioni, non tutte. In v6 "60 € lordi a notte" senza "trasferte di più giorni" passa.
- Le regole "hashtag diverso dalil Focus", "RAL negli overlay solo con il Focus stipendio" e "anni solo in experience" sono solo nel prompt. Restano errori di italiano (vedi [prompts.md](prompts.md)).
- **La qualità dei prompt è misurata su un solo giro per versione** e una sola Job Offer: le differenze tra versioni non sono statisticamente significative.

## Con un giorno in più

In ordine di priorità:

1. **Un set di valutazione**: più Job Offer (tipi di ruolo diversi, con e senza RAL e trasferte) × N giri per versione, con il giudice automatico (rubrica di `agent-channel-judge`) e un controllo grammaticale. Così il confronto tra versioni dei prompt diventa misurabile.
2. **Tutte le condizioni dei benefit, non almeno una**, e nel codice anche le regole oggi solo nel prompt: hashtag diverso dalil Focus, RAL negli overlay solo con il Focus stipendio, anni solo in experience. Poi i numeri di `jo_001` tolti dagli esempi dei prompt.
3. **`request_id` in `generation_runs`**, con `ref` alla Variante e l'esposizione dei tentativi nell'API e nella UI.
4. **Autenticazione** e attribuzione delle Versioni manuali a una persona.
5. **Migrazioni versionate** dello schema, al posto di `CREATE TABLE IF NOT EXISTS` + `db:reset`.
6. **Dipendenza della UI copiata nella repo** (Preact + htm), invece della CDN senza SRI.
7. **Stati e UI**: guardia anche sullo scarto dell'ultima Variante attiva di un Annuncio pubblicato; editor a campi per canale; vista del Brief; modifica completa del Luogo.
8. **Rendering della Creative in PNG** da un template HTML, per avere un file pronto per il designer.
