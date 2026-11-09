# SPEC — Sezione Annunci

> Vocabolario: vedi `GLOSSARY.md`. Decisioni architetturali: `docs/adr/`. Etichetta: `ready-for-agent`.

## Problem Statement

Quando si apre una nuova posizione, il Team Delivery di Gyver deve preparare tutto ciò che verrà comunicato all'esterno per attirare tecnici qualificati: un annuncio per Indeed, creative per le ads su Instagram e TikTok, una scheda da girare su WhatsApp. Oggi parte ogni volta da una Job Offer densa di informazioni interne e non pubblicabili, riscrive a mano lo stesso contenuto per ogni canale rispettandone vincoli e tono, deve ricordarsi cosa non dire (indirizzo esatto, dettagli contrattuali interni), vuole provare messaggi diversi per capire quale attrae di più, e non ha un posto unico dove vedere quali annunci esistono, dove, in che formato e in che stato.

## Solution

Una sezione Annunci in cui il Team Delivery sceglie una Job Offer, un Canale, un Formato e un Luogo, indica uno o più Angoli, e ottiene un Annuncio con una Variante generata dall'LLM per ogni Angolo, già adattata ai vincoli del canale. Il sistema estrae prima dalla Job Offer un Brief di fatti pubblicabili, condiviso da tutti gli annunci di quella offer, così i fatti restano coerenti e i dati interni non finiscono nel copy. Il team può rivedere e correggere a mano qualsiasi contenuto, aggiungere nuove Varianti per testare altri messaggi, rigenerarle, scartare quelle che non funzionano e far avanzare lo Stato dell'Annuncio. Ogni modifica è conservata come Versione, quindi resta visibile cosa ha scritto l'LLM e cosa ha cambiato il team. Una pagina minima permette di vedere l'elenco, creare e modificare, con un'anteprima che rispecchia l'aspetto sul canale.

## User Stories

### Consultazione
1. Come membro del Team Delivery, voglio vedere l'elenco di tutti gli Annunci con Canale, Formato, Stato e Luogo, così ho il quadro di cosa è uscito e dove.
2. Come membro del Team Delivery, voglio filtrare gli Annunci per Job Offer, così vedo tutto ciò che riguarda una posizione.
3. Come membro del Team Delivery, voglio filtrare gli Annunci per Canale, così controllo cosa è attivo per esempio su WhatsApp.
4. Come membro del Team Delivery, voglio filtrare gli Annunci per Stato, così trovo le bozze da completare.
5. Come membro del Team Delivery, voglio combinare i filtri (Job Offer + Canale + Stato), così rispondo a domande precise senza scorrere tutto.
6. Come membro del Team Delivery, voglio aprire un Annuncio e vedere tutte le sue Varianti con l'Angolo e la Versione corrente, così confronto i messaggi in test.
7. Come membro del Team Delivery, voglio vedere lo storico delle Versioni di una Variante con l'Origine di ciascuna, così so cosa ha prodotto l'LLM e cosa è stato corretto a mano.
8. Come membro del Team Delivery, voglio vedere le Job Offer disponibili, così scelgo da quale partire.
9. Come membro del Team Delivery, voglio vedere quali Formati sono ammessi per ogni Canale e con quali vincoli, così non creo combinazioni impossibili.
10. Come membro del Team Delivery, voglio vedere il Brief di una Job Offer, così controllo quali fatti l'LLM considera pubblicabili.

### Creazione e generazione
11. Come membro del Team Delivery, voglio creare un Annuncio scegliendo Job Offer, Canale e Formato, così parto da quello che mi serve pubblicare.
12. Come membro del Team Delivery, voglio che il Luogo dell'Annuncio sia proposto dalla sede della Job Offer ma modificabile, così posso pubblicare la stessa posizione su città diverse.
13. Come membro del Team Delivery, voglio indicare un'etichetta libera per il Luogo (es. "Orzinuovi (BS) + trasferte"), così il pubblico legge una formula chiara e non un indirizzo burocratico.
14. Come membro del Team Delivery, voglio indicare da 1 a 3 Angoli alla creazione, così ottengo subito le Varianti da mettere in test.
15. Come membro del Team Delivery, voglio suggerimenti di Angoli (carriera, stipendio, multinazionale), così non devo inventarli ogni volta.
16. Come membro del Team Delivery, voglio che il contenuto generato rispetti la struttura del canale (per Indeed indirizzo, competenze, esperienza e descrizione; per WhatsApp titolo, etichette brevi e sezioni a punti; per i social testo in sovrimpressione e didascalia), così è pronto da pubblicare.
17. Come membro del Team Delivery, voglio che il contenuto rispetti i vincoli del Formato di Canale (lunghezze, dimensioni immagine), così non viene troncato o rifiutato dalla piattaforma.
18. Come membro del Team Delivery, voglio che il tono sia adatto al canale (diretto e informale su WhatsApp e social, più completo su Indeed), così parla ai tecnici nel modo giusto.
19. Come membro del Team Delivery, voglio che i dati interni della Job Offer non compaiano nel copy esterno, così non espongo informazioni riservate.
20. Come membro del Team Delivery, voglio che l'indirizzo esatto non compaia sugli annunci social e WhatsApp, così mostro solo l'area geografica.
21. Come membro del Team Delivery, voglio che la retribuzione mostrata sia coerente con la Job Offer, così non prometto cifre sbagliate.
22. Come membro del Team Delivery, voglio che per i Formati con immagine la Variante includa una Creative (testi in sovrimpressione, parola da evidenziare, soggetto della foto, dimensioni), così il designer o il template sa cosa produrre.
23. Come membro del Team Delivery, voglio che il Brief venga generato una sola volta per Job Offer e riusato, così i fatti sono coerenti tra canali e la creazione è più veloce.
24. Come membro del Team Delivery, voglio poter rigenerare il Brief, così posso aggiornarlo se la generazione precedente non mi convince.
25. Come membro del Team Delivery, voglio ricevere un errore chiaro se chiedo una combinazione Canale × Formato non ammessa, così capisco subito cosa cambiare.
26. Come membro del Team Delivery, voglio che un nuovo Annuncio parta in Stato bozza, così niente sembra pubblicato prima che lo decida io.

### Varianti e Versioni
27. Come membro del Team Delivery, voglio aggiungere una nuova Variante a un Annuncio esistente indicando un Angolo, così posso testare un messaggio in più.
28. Come membro del Team Delivery, voglio rigenerare una Variante con lo stesso Angolo, così ottengo una formulazione diversa senza perdere quella precedente.
29. Come membro del Team Delivery, voglio sovrascrivere il contenuto di una Variante con una versione scritta a mano, così correggo o miglioro il testo generato.
30. Come membro del Team Delivery, voglio che la mia modifica manuale sia validata con le stesse regole del canale, così non pubblico per errore contenuti fuori formato.
31. Come membro del Team Delivery, voglio un messaggio che dica esattamente quale campo della mia modifica non rispetta i vincoli, così la sistemo in fretta.
32. Come membro del Team Delivery, voglio che la Versione corrente sia sempre l'ultima creata, così so cosa sto guardando.
33. Come membro del Team Delivery, voglio scartare una Variante che ha perso il test, così resta nello storico ma non la considero più.
34. Come membro del Team Delivery, voglio che ogni Versione registri modello, versione del prompt e Brief di partenza, così posso capire perché un contenuto è venuto in un certo modo.

### Stato e Luogo
35. Come membro del Team Delivery, voglio cambiare lo Stato di un Annuncio (bozza, pronto, pubblicato, in pausa, archiviato), così l'elenco riflette cosa sta succedendo davvero.
36. Come membro del Team Delivery, voglio archiviare un Annuncio invece di cancellarlo, così non perdo la sua storia.
37. Come membro del Team Delivery, voglio modificare il Luogo di un Annuncio, così correggo un errore di targeting.

### Errori e affidabilità
38. Come membro del Team Delivery, voglio che, se l'LLM restituisce un contenuto non conforme, il sistema riprovi automaticamente una volta spiegandogli l'errore, così la maggior parte dei problemi si risolve da sola.
39. Come membro del Team Delivery, voglio che, se anche il secondo tentativo fallisce, non venga salvato nulla e io riceva un errore con un riferimento al tentativo, così non mi ritrovo contenuti rotti e posso segnalarlo.
40. Come membro del Team Delivery, voglio un errore chiaro se la chiave dell'LLM non è configurata o il servizio non risponde, così distinguo un problema di configurazione da un problema di contenuto.
41. Come membro del Team Delivery, voglio errori "non trovato" chiari quando chiedo una Job Offer, un Annuncio o una Variante inesistente, così capisco l'errore.

### Interfaccia minima
42. Come membro del Team Delivery, voglio una pagina con l'elenco degli Annunci e i filtri, così uso la sezione senza strumenti tecnici.
43. Come membro del Team Delivery, voglio un modulo per creare un Annuncio da una Job Offer, così il flusso completo è a portata di click.
44. Come membro del Team Delivery, voglio un'anteprima per canale (scheda A4 per WhatsApp, quadrato per i social, testo per Indeed), così vedo il risultato come lo vedrà il tecnico.
45. Come membro del Team Delivery, voglio modificare il contenuto di una Variante dalla pagina e vedere subito la nuova Versione, così chiudo il ciclo senza API.

### Chi valuta / sviluppatore
46. Come valutatore, voglio aprire la repo e trovare un database già popolato con gli esempi del PDF, così vedo subito il risultato.
47. Come valutatore, voglio far girare il progetto con un solo comando dopo aver impostato la chiave, così non devo chiedere nulla.
48. Come sviluppatore, voglio poter aggiungere un canale di un tipo già esistente aggiungendo dati e non codice, così il modello regge se cambiano i canali.
49. Come sviluppatore, voglio test che girano senza rete né chiave LLM, così la suite è veloce e affidabile.

## Implementation Decisions

### Moduli
- **Persistenza**: accesso al database SQLite (schema, seed, query). Nessun ORM: SQL esplicito per leggibilità del modello.
- **Catalogo canali**: legge Canali e Formati di Canale dal DB; espone per ogni Canale il tipo e i vincoli. Associa ogni tipo di canale (job board, ads social, messaggistica) a uno schema di contenuto definito nel codice (ADR 0001).
- **Validazione contenuto**: interfaccia unica `valida(contenuto, formatoDiCanale) → ok | lista di problemi per campo`. Applica schema del tipo di canale + vincoli del Formato di Canale + regole di business (niente indirizzo esatto per social e messaggistica, retribuzione coerente con la Job Offer). Usata sia per l'output LLM sia per le Versioni manuali.
- **Client LLM** (`LlmClient`): interfaccia con due operazioni: genera Brief da Job Offer; genera contenuto di una Variante da Brief + Formato di Canale + Angolo + Luogo. Implementazione OpenAI con structured outputs; implementazione finta per i test. Unico punto di sostituzione del sistema.
- **Generazione**: orchestra Brief (riuso o creazione) → contenuto → validazione → un retry con i problemi nel prompt → esito. Registra ogni tentativo come Tentativo di generazione.
- **Annunci**: casi d'uso: crea Annuncio, aggiungi Variante, rigenera Variante, salva Versione manuale, scarta Variante, cambia Stato, cambia Luogo, consulta.
- **API HTTP**: Elysia, costruita da una funzione che riceve DB e `LlmClient` (seam dei test). Serve anche la pagina statica.
- **Interfaccia**: pagina unica Preact + htm da CDN, token visivi presi da gyver.work.

### Schema dati
- `job_offers`: id, titolo, azienda, stato, payload completo della Job Offer (JSON). Sola lettura.
- `briefs`: id, job_offer_id, contenuto (JSON), modello, versione prompt, creato il. Il più recente per Job Offer è quello in uso.
- `channels`: id (es. `indeed`), nome, tipo (`job_board` | `social_ad` | `messaging`), linee guida di tono.
- `channel_formats`: channel_id, formato (`text` | `image` | `image_text`), vincoli (JSON: lunghezze massime, dimensioni immagine, campi obbligatori). Chiave composta.
- `ads`: id, job_offer_id, channel_id, formato, stato (`draft` | `ready` | `published` | `paused` | `archived`), Luogo come colonne (etichetta, comune, provincia, sigla provincia, regione, paese), creato/aggiornato il. Vincolo di integrità verso `channel_formats`. Indici su job_offer_id, channel_id, stato.
- `variants`: id, ad_id, etichetta (A, B, C…), Angolo, attiva (bool), creato il.
- `versions`: id, variant_id, numero progressivo per Variante, contenuto (JSON con forma del tipo di canale, Creative inclusa per i formati con immagine), Origine (`llm` | `manual`), brief_id (null se manuale), modello, versione prompt, creato il. Append-only. Corrente = numero più alto.
- `generation_runs`: id, tipo (`brief` | `variant`), riferimento, tentativo, esito (`ok` | `invalid` | `error`), problemi, risposta grezza, creato il.
- Nessuna cancellazione fisica di Annunci, Varianti o Versioni.

### Contratto API
- `GET /api/job-offers`, `GET /api/job-offers/:id` (include il Brief corrente se esiste).
- `POST /api/job-offers/:id/brief`: rigenera il Brief.
- `GET /api/channels`: Canali con i Formati ammessi e i vincoli.
- `GET /api/ads?job_offer_id&channel&status`: elenco con Canale, Formato, Stato, Luogo e numero di Varianti attive.
- `GET /api/ads/:id`: dettaglio con Varianti e Versione corrente.
- `GET /api/variants/:id/versions`: storico Versioni.
- `POST /api/ads`: corpo con job_offer_id, channel, format, location opzionale, angles (1–3, default uno suggerito). Crea l'Annuncio in bozza e genera una Variante per Angolo.
- `POST /api/ads/:id/variants`: corpo con angle. Nuova Variante generata.
- `POST /api/variants/:id/regenerate`: nuova Versione LLM con lo stesso Angolo.
- `PUT /api/variants/:id/content`: contenuto manuale → nuova Versione `manual` se valida.
- `PATCH /api/variants/:id`: attiva/scartata.
- `PATCH /api/ads/:id`: Stato e/o Luogo.
- Errori in forma uniforme `{ error: { code, message, details? } }`: 400 input non valido; 404 risorsa inesistente; 422 combinazione Canale × Formato non ammessa o contenuto manuale non conforme (con problemi per campo); 502 generazione fallita dopo il retry (con id del Tentativo); 503 LLM non configurato o non raggiungibile.
- Creazione con più Angoli: se una Variante fallisce, l'Annuncio e le Varianti riuscite restano salvati e la risposta elenca gli Angoli falliti.

### Generazione e prompt
- Due passi (ADR 0003). Prompt del Brief: estrarre fatti pubblicabili, punti di forza, cosa non dire. Prompt di canale: uno per tipo di canale, riceve Brief, vincoli, tono, Angolo, Luogo; mai la Job Offer grezza.
- Output vincolato con structured outputs (schema dal tipo di canale) e poi rivalidato con le regole di business, che lo schema non può esprimere.
- Prompt versionati con un identificatore salvato su ogni Versione e Brief.
- Modello configurabile da variabile d'ambiente.

### Configurazione
- Variabili: `OPENAI_API_KEY` (obbligatoria solo per generare), `OPENAI_MODEL`, `PORT` (default 3000), percorso del database.
- Seed: jo_001, i quattro Canali, i Formati di Canale ammessi, e i tre esempi del PDF (WhatsApp A4 immagine+testo, Indeed testo, social 1:1 immagine) come Annunci con Versione di Origine `manual`.

## Testing Decisions

- Un buon test verifica il comportamento osservabile dall'esterno: richiesta HTTP in ingresso, risposta e stato persistito in uscita. Niente test su funzioni interne o sulla forma delle query.
- **Seam unico**: l'app HTTP costruita con DB SQLite in memoria (seed caricato) e `LlmClient` finto programmabile. I test chiamano l'app direttamente, senza porte né rete.
- `LlmClient` finto con scenari: contenuto valido; non conforme poi valido (verifica retry e Versione salvata); sempre non conforme (502, nessuna Versione, Tentativi `invalid` registrati); errore di rete (503); risposta con indirizzo esatto su social (rifiutata dalle regole di business).
- Casi da coprire: filtri dell'elenco; creazione con combinazione non ammessa (422); creazione con più Angoli e una fallita; riuso del Brief tra due Annunci della stessa Job Offer; Versione manuale valida (nuova Versione corrente, storico intatto) e non valida (422 con campi); rigenerazione; scarto Variante; cambio Stato e Luogo; 404.
- Eccezione ammessa: test diretti sulle regole di validazione per canale solo se dall'API risultano scomodi.
- Prior art: nessuna, la repo è nuova. Runner: test integrato di Bun.
- Nessun test sulla UI né chiamate reali a OpenAI nella suite; il flusso reale si verifica a mano seguendo il README.

## Out of Scope

- Pubblicazione reale sui canali (Indeed, Meta, TikTok, WhatsApp) e sincronizzazione dello Stato con le piattaforme.
- Generazione dei file immagine: si produce solo la Creative descrittiva con anteprima HTML.
- Metriche di performance delle Varianti e chiusura automatica dei test A/B.
- Matrice copy × creative separate (una Variante tiene insieme testo e Creative).
- Modifica manuale del Brief; ripristino di una Versione precedente.
- Gestione delle Job Offer (creazione e modifica): sono input esterni.
- Autenticazione, utenti e permessi; attribuzione delle modifiche a una persona.
- Anagrafica dei Luoghi riusabili e geocoding.
- Multilingua: contenuti solo in italiano.

## Further Notes

- Budget totale 4h–4h30: in caso di ritardo si taglia nell'ordine formato TikTok 9:16, anteprime grafiche, visualizzazione dei Tentativi di generazione, test secondari. Tutto ciò che resta fuori va in `tradeoffs.md`.
- Il modello dati è la parte più valutata: `architecture.md` deve spiegare la gerarchia Job Offer → Brief / Annuncio → Variante → Versione e i perché degli ADR.
- Elysia e Bun sono poco familiari: prima del build va scritto un promemoria con le API verificate sulla documentazione ufficiale.
