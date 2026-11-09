# Log dei prompt

Iterazioni dei prompt di generazione (Job Offer → Brief → contenuto della Variante). Campioni: `bun run gen:sample` su jo_001, uno per Formato di Canale ammesso, modello `gpt-4o-mini-2024-07-18`, in `docs/samples/<versione-prompt-canale>/`. Il campo `runs` di ogni campione registra ogni tentativo; "primo tentativo" significa `runs[0].outcome = ok`, senza retry.

Da v2 i quattro prompt (brief, job_board, social_ad, messaging) sono versionati insieme: il Brief entra in ogni prompt di canale, quindi una modifica al Brief cambia l'output di tutti i canali. Sempre da v2 lo script dei campioni ruota i `suggestedAngles` del Brief sui campioni (indeed e tiktok Angolo 1, instagram-image e whatsapp-image_text Angolo 2, instagram-image_text e whatsapp-text Angolo 3), così i campioni coprono Angoli diversi.

## Esito al primo tentativo

| Canale × Formato | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| indeed-text | ok | ok | ok | ok |
| instagram-image | retry (highlightWord) | ok | ok | ok |
| instagram-image_text | ok | ok | ok | ok |
| tiktok-image | ok | **fallito anche al retry** (caption 166 → 200 caratteri, max 150) | retry (caption 157/150) | ok |
| whatsapp-image_text | ok | ok | ok | retry (highlightWord) |
| whatsapp-text | ok | ok | ok | ok |
| **Totale** | 5/6 | 5/6 | 5/6 | 5/6 |

Il criterio di chiusura (tutti e 6 al primo tentativo) **non è stato raggiunto** entro il tetto di 3 iterazioni. Ogni versione ha un solo fallimento al primo tentativo, e cambia campione: `creative.highlightWord` assente dagli overlayTexts (v1, v4) e caption TikTok oltre i 150 caratteri (v2, v3).

## v1 (baseline: brief@v1, job_board@v1, social_ad@v1, messaging@v1)

Tutti i campioni sull'Angolo "carriera" (lo script usava solo `suggestedAngles[0]`).

Problemi osservati:
- **Brief, doNotSay copiato dall'esempio del prompt**: compaiono `"Percentuali di straordinari"` e `"Note per il recruiter"`, ma la Job Offer non contiene note per il recruiter. Manca la voce vera (ore di viaggio oltre le 8 pagate all'85%). Causa: la lista d'esempio nell'istruzione è stata presa come contenuto.
- **Brief, condizione sfavorevole in un campo pubblicabile**: `travel: "Trasferte giornaliere frequenti (senza indennità)"`, mentre doNotSay dice `"Trasferte non indennizzate"`. Causa: il prompt non diceva come scrivere travel.
- **Nome azienda sbagliato**: `companyName: "AB Group"` (nella Job Offer è "AB Group SpA"). Causa: il Brief non aveva un campo companyName, ma i prompt di canale dicevano "come nel Brief".
- **Fatti non nella Job Offer**: `"Ambiente di lavoro internazionale"`, `"Crescita professionale"` (badge WhatsApp), `"Riconoscimento per la tua esperienza"`, `"opportunità uniche"`. Causa: nessuna regola contro le promesse generiche.
- **Azienda in prima persona**: `"siamo specializzati in rinnovabili"`, `"Offriamo..."`. Causa: voce di chi parla non specificata.
- **Esperienza incoerente**: Indeed `experience: "3-5 anni"` ma bullet `"Almeno 3-4 anni..."`. Causa: requirements ripeteva gli anni dal testo libero.
- **Forma**: hashtag con spazio iniziale (`" #Tecnico"`), `**carriera**` in caption, `"RAL 32-38k€"`, bullet WhatsApp che mescolano infinito e futuro.
- **highlightWord** assente dagli overlayTexts al primo tentativo (instagram-image).

## v2 (brief@v2, job_board@v2, social_ad@v2, messaging@v2)

Modifiche:
- `companyName` aggiunto allo schema del Brief (`src/domain/brief-schema.ts`, e al fake client).
- Brief: tolta la lista d'esempio da doNotSay. Ora: rileggere le righe di retribuzione/trasferte/orari ed elencare solo condizioni presenti. `travel` neutro, senza condizioni sfavorevoli. Anni solo in `experience`. `responsibilities` in seconda persona, con gli oggetti concreti. `benefits` senza RAL e contratto. sellingPoints solo con fatti concreti, niente deduzioni.
- Regole comuni: si parla a nome di Gyver, azienda in terza persona; niente promesse generiche; RAL in forma estesa ("RAL da 32.000 a 38.000 €", mai "k"); companyName identico; niente markdown; trasferte citate in modo neutro.
- Indeed: 4 sezioni nell'ordine dell'esempio del PDF; titolo = ruolo + ":" + specifica. Social: overlay riga 1 = ruolo, riga 2 = Angolo + fatto; highlightWord di una parola copiata da una riga; hashtag "#parola" senza spazi; massimo 3 emoji. WhatsApp: badge con l'Angolo per primo, sezioni nell'ordine dell'esempio.

Esito: il Brief ha `companyName: "AB Group SpA"`, travel neutro e `doNotSay: ["Trasferte giornaliere frequenti (senza indennità)"]` (manca ancora la riga dell'85%). Niente più prima persona né promesse generiche su WhatsApp/Indeed. Restano:
- **tiktok-image fallisce entrambi i tentativi**: caption 166, poi 200 caratteri (max 150). Causa: l'istruzione chiede Angolo + 2-3 fatti + invito, che non stanno in 150 caratteri, e il modello non conta i caratteri.
- Indeed mette la via nella descrizione: `"Sede presso Via Artigianato 27, 25034 Orzinuovi (BS)."` La validazione lo ammette su job_board, ma le linee guida di tono di Indeed vogliono l'indirizzo solo nel campo address.
- Instagram usa ancora `"Offriamo RAL..."`. highlightWord come frase: `"RAL da 32.000 a 38.000 €"`.
- L'Angolo "carriera" non ha un sellingPoint che lo sostenga: whatsapp-text (carriera) apre i badge con la RAL.
- Nota: un primo giro v2, lanciato per errore prima del salvataggio delle regole comuni, ha fallito whatsapp-image_text anche al retry (issue non catturata). Quel giro è stato sovrascritto. Da allora lo script stampa le issue di ogni tentativo quando fallisce.

## v3 (brief@v3, job_board@v3, social_ad@v3, messaging@v3)

Modifiche:
- `constraintsText` (variant-context): per i campi fino a 300 caratteri aggiunge un budget di parole (`max / 8`).
- Caption social: il limite è rigido; se è breve, al massimo due frasi (Angolo con un fatto + invito). highlightWord "senza spazi".
- Indeed: nella descrizione la sede è il Luogo, mai la via; l'indirizzo completo solo in `address`.
- WhatsApp: Luogo e trasferte in un unico badge (`"Orzinuovi (BS) + trasferte"`), badge dell'Angolo con un fatto; overlay = titolo diviso ai due punti.
- Brief: 4-5 sellingPoints su retribuzione, dimensione dell'azienda, impianti, contratto e carriera quando la Job Offer li dichiara; un sellingPoint per Angolo. doNotSay: riga per riga, pubblicabile o doNotSay.
- Regola comune "mai 'offriamo'".

Esito: Indeed non ha più la via nella descrizione. Nessuna prima persona dell'azienda. Restano:
- **tiktok-image al primo tentativo** 157/150 (passa al retry). Il budget di parole (18) è ancora largo.
- **Brief, doNotSay vuoto** (`[]`): la clausola "se non ce ne sono, lascia la lista vuota" ha offerto una scappatoia. La riservatezza regge comunque nei testi.
- Nessun sellingPoint "carriera": instagram-image_text (carriera) scrive `"Inizia la tua carriera"` (sbagliato per chi ha 3-5 anni di esperienza). whatsapp-text (carriera) apre con `"Multinazionale..."`.
- highlightWord ancora come frase: `"RAL da 32.000 €"`.
- Indeed con Angolo "stipendio": il titolo non esprime l'Angolo (`"...: specialista in installazioni e collaudi"`).

## v4 (brief@v4, job_board@v4, social_ad@v4, messaging@v4)

Modifiche:
- `constraintsText`: per i campi fino a 300 caratteri chiede un obiettivo pari a circa 2/3 del massimo, con budget di parole (`"punta a circa 100 caratteri, 12 parole"` per la caption da 150).
- Brief: ogni voce di doNotSay deve citare il testo della Job Offer da cui viene (ciò che non si può citare non va elencato); tolto "lascia vuota". I primi tre sellingPoints corrispondono, nell'ordine, ai tre suggestedAngles.
- Regola comune: il candidato ha già esperienza (mai "inizia la tua carriera").
- Indeed: titolo = ruolo + specifica in chiave Angolo (carriera → cosa farà, stipendio → RAL, azienda → dimensione).
- highlightWord: "una parola sola, mai una frase", con esempi.

Esito: TikTok passa al primo tentativo (caption di 88 caratteri). doNotSay completo: `"Trasferte giornaliere frequenti (senza indennità)"`, `"Ore di viaggio oltre le 8 ore giornaliere pagate all'85% della paga base come da CCNL"`. Nessuna delle due voci compare nei testi. Il titolo Indeed porta l'Angolo (`"Tecnico Elettricista Fotovoltaico: RAL fino a 38.000 €"`). Restano:
- **whatsapp-image_text al primo tentativo**: highlightWord non presente negli overlayTexts (passa al retry con `"impianti"`).
- **Nomi degli Angoli regrediti**: il Brief restituisce `["retribuzione", "dimensione dell'azienda", "tipo impianti"]`. L'elenco dei temi aggiunto al prompt è stato letto come elenco di nomi. "carriera" è sparito, e "dimensione dell'azienda" sono tre parole.
- highlightWord ancora come frase in instagram-image_text: `"Impianti sopra i 100 kW"`.
- Overlay fuorviante: `"RAL da 38.000 €"` (instagram-image_text) fa pensare a un minimo di 38.000. La cifra è nel range, quindi la validazione la accetta.
- Indeed: bullet che finiscono con la virgola (`"...cogenerazione e biogas,"`, `"Sede a Orzinuovi (Brescia),"`).

## Prossimi passi (non fatti, tetto di iterazioni raggiunto)

- highlightWord: è il fallimento al primo tentativo più frequente (v1, v4). Con gpt-4o-mini l'istruzione nel prompt non basta. Opzioni: un pattern `^\S+$` nello schema della Creative (gli structured outputs imporrebbero una sola parola), oppure normalizzazione/validazione nel codice. Sono decisioni di schema e validazione, non di prompt.
- Brief: dare gli esempi di Angolo solo come nomi ("carriera", "stipendio", "multinazionale"), non come temi; e richiedere "carriera" quando il titolo della Job Offer la nomina.
- Retribuzione negli overlay brevi: ammettere solo "RAL fino a <max> €" o il range completo, mai "RAL da <max>".
