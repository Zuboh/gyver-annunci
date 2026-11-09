# Workflow con l'AI

Il progetto è stato sviluppato con Claude Code (Opus 5.5) come ambiente principale e `gpt-4o-mini` come modello del prodotto. Il diario di lavoro è [`docs/ai-log.md`](docs/ai-log.md), la storia dei prompt è [`docs/prompt-log.md`](docs/prompt-log.md). Questo documento ne riassume il flusso.

## Il flusso

L'idea guida: **prima si fissano lingua e decisioni, poi si delega in parallelo con contratti scritti, e chi giudica non è chi produce.**

| Fase | Strumento | Output |
|---|---|---|
| 1. Piano | Plan mode di Claude Code; le scelte di stack e LLM chieste all'umano con AskUserQuestion | Stack Bun + Elysia + `bun:sqlite` + Preact/htm + OpenAI structured outputs |
| 2. Modellazione | Skill Matt Pocock **`grill-with-docs`** (`grilling` + `domain-modeling`): 3 round, 20 decisioni | [`GLOSSARY.md`](GLOSSARY.md) e 3 ADR in [`docs/adr/`](docs/adr/) |
| 3. Specifica | Skill **`to-spec`** | [`docs/SPEC.md`](docs/SPEC.md): 49 user story, schema, contratto API, seam di test unico |
| 4. Ricerca | Skill **`research`**, in un agent in background, solo su fonti primarie | Cheat sheet [`docs/research/elysia-bun.md`](docs/research/elysia-bun.md) con versioni da fissare e pitfall |
| 5. Agent di progetto | Skill **`writing-for-agents`** | 3 agent in [`.claude/agents/`](.claude/agents/): `agent-prompt-engineer`, `agent-channel-judge`, `agent-assessment-docs` |
| 6. Backend | **`agent-orchestrator`**, che coordina `agent-code-writer` e `agent-tester` | Contratti, poi dati/API e pipeline LLM in parallelo, poi test |
| 7. UI | **`agent-design-system`** | [`public/`](public/): Preact + htm, token presi dal CSS pubblico di gyver.work |
| 8. Prompt | Ciclo `agent-prompt-engineer` ↔ `agent-channel-judge` | Prompt v1 → v5, campioni in [`docs/samples/`](docs/samples/) |
| 9. Revisione | Code review e security review in parallelo | In corso, vedi sotto |
| 10. Documenti | `agent-assessment-docs` | I cinque documenti della traccia, con i comandi del README provati su una copia pulita |

Le skill `grill-with-docs`, `to-spec` e `implement` hanno `disable-model-invocation`, quindi le ha lanciate l'umano. Il modello non può saltare la fase di modellazione da solo.

### Perché così

- **Glossario e ADR prima del codice.** Il modello dati è la parte più valutata. `grill-with-docs` costringe a decidere cosa sia un Annuncio, una Variante, una Versione e un Luogo prima che un agent lo inventi. Ogni agent successivo legge `GLOSSARY.md`, quindi la stessa parola ha lo stesso significato nel codice, nei prompt e nella UI.
- **Il cheat sheet prima del build.** Elysia e Bun erano poco familiari, e il tag `latest` di Elysia su npm puntava a una RC 2.0. Un promemoria verificato evita che ogni agent riscopra le API, o le inventi.
- **Contratti, poi parallelo.** Nello step 1 un agent ha scritto i tipi, gli schemi, `LlmClient` con il client finto e `validateContent`. Nello step 2 due `agent-code-writer` hanno lavorato in parallelo, A su dati e API e B sulla pipeline LLM, con ownership dei file rigida e firme concordate nei prompt di dispatch: nessuna collisione. Nello step 3 `agent-tester` ha scritto 39 test attraverso l'unico seam `createApp`.
- **Il generatore non giudica se stesso.** `agent-prompt-engineer` scrive i prompt, genera i campioni reali e registra fatti come il primo tentativo e i retry. `agent-channel-judge`, in sola lettura, li valuta con una rubrica di 7 criteri da 0 a 2. È un ciclo in stile GAN: il giudice trova ciò che il generatore non vede.

## Il ciclo dei prompt

- **v1 → v4**: ogni versione ha passato **5/6** campioni al primo tentativo, e il fallimento cambiava campione: `highlightWord` fuori dagli overlay in v1 e v4, caption TikTok oltre 150 caratteri in v2 e v3. Il tetto di 3 iterazioni è stato raggiunto senza 6/6.
- **Giudice su v4** ([`docs/judge-report-v4.md`](docs/judge-report-v4.md)): 5/6 accettati. **whatsapp-image_text è respinto con Fedeltà = 0.** "Indennità di 60 € per le trasferte" generalizza un'indennità che la Job Offer prevede solo a notte nelle trasferte di più giorni. Il rischio vero non era la fuga di dati riservati, che reggeva ovunque: era un benefit parafrasato tanto largo da contraddire le condizioni nascoste.
- **v5**: le 5 correzioni prioritarie del giudice sono diventate prompt **e** codice: condizione dell'indennità, forma della retribuzione, `highlightWord` di una parola, Angoli allineati ai sellingPoints. Due giri, entrambi **6/6** al primo tentativo. Restano alcuni limiti, elencati in [prompts.md](prompts.md).
- Costo stimato di tutti i giri: meno di 0,05 $.

## Cosa l'AI ha sbagliato e come è stato scoperto

| Errore | Come è emerso | Correzione |
|---|---|---|
| **`t.UnionEnum` dentro `t.Optional` inietta il primo valore come default**: `?channel=indeed` diventava `status=draft` e `PATCH {}` passava | L'agent A l'ha visto filtrando l'elenco. Il tester l'ha poi blindato con una mutazione: tornare a `t.UnionEnum` fa fallire 23 test | `t.Union` di `t.Literal` ([`ads-routes.ts`](src/http/ads-routes.ts)) e test di regressione in [`test/ads-listing.test.ts`](test/ads-listing.test.ts) |
| **Pitfall sbagliati nel cheat sheet.** Il pitfall 3 diceva che "un `onError` registrato prima di un plugin non copre le sue route": falso, una prova lo ha smentito. Il pitfall 13, sulla proprietà `code` degli errori, era marcato "non verificato" ed era vero. Il cheat sheet suggeriva 422 per gli errori di validazione, mentre la SPEC dice 400 | Prove eseguite dentro la repo prima di scrivere `app.ts` | `onError` prima delle route; `AppError` riconosciuto con `instanceof` prima dello switch su `code`; 400 come da SPEC. Inoltre: importare `elysia` da fuori dalla repo installa da solo Elysia 2.0 dalla cache globale, quindi le prove si lanciano dentro la repo |
| **Benefit generalizzato** ("Indennità di 60 € per le trasferte") | Il giudice indipendente, con Fedeltà 0. La validazione lo lasciava passare | `benefitConditionIssues` in [`business-rules.ts`](src/validation/business-rules.ts) e regola nei prompt |
| **`highlightWord` come frase** ("RAL da 32.000 a 38.000 €", "Impianti sopra i 100 kW") | Ricorrente nel prompt-log da v2 a v4 e confermato dal giudice. Le istruzioni nel prompt non bastavano | Una sola parola (`^\S+$`) e presente come parola intera negli overlay, controllato in [`validate-content.ts`](src/validation/validate-content.ts) |
| `chat.completions.parse()` raccomandato dal cheat sheet | L'agent B ha visto che lancia `ZodError` e perde il testo grezzo | `create` + `zodResponseFormat` + `JSON.parse` manuale |
| Il primo agent dello step 1 è morto per un errore di rete (ENOTFOUND) | Interruzione | Un secondo agent ha rivisto i file parziali e completato il lavoro |
| Uno smoke test ha scritto una riga `generation_runs` nel DB versionato | Controllo del coordinatore prima del commit | `db:reset`. Regola: mai chiamare gli endpoint di generazione contro `data/gyver.db` |
| La UI di prova ha fatto due chiamate OpenAI vere anche se il brief diceva "nessuna chiave" | Bun carica da solo `.env` | Server di prova avviato con `OPENAI_API_KEY=` vuota e un DB copiato |
| Pagina troncata dopo aver modificato `index.html` | Headless Chrome: mancava `<script>` | Il server tiene il Content-Length dell'avvio, quindi va riavviato. Annotato in [tradeoffs.md](tradeoffs.md) |
| L'anteprima WhatsApp usciva dal riquadro; l'avviso "supera l'A4" dipendeva dal font dell'anteprima | Verifica visiva | Altezza minima A4 con container query; avviso rimosso |

## Strumenti

- **Skill Matt Pocock**: `grill-with-docs` (`grilling` + `domain-modeling`), `to-spec`, `research`, `writing-for-agents`. Danno processi ripetibili invece di prompt improvvisati.
- **Agent personali** (fuori dalla repo, comuni a tutti i progetti): `agent-orchestrator`, `agent-code-writer`, `agent-tester` e `agent-design-system`. Ognuno ha un contratto stretto.
- **Agent di progetto** in [`.claude/agents/`](.claude/agents/):
  - `agent-prompt-engineer`: iterazioni versionate, campioni reali, voce nel prompt-log;
  - `agent-channel-judge`: rubrica di 7 criteri, sola lettura, ogni giudizio cita l'estratto;
  - `agent-assessment-docs`: la checklist della traccia per questi documenti.
- **Script**: [`scripts/gen-sample.ts`](scripts/gen-sample.ts) genera un campione per Formato di Canale con il modello vero, su un DB in memoria; [`scripts/db-reset.ts`](scripts/db-reset.ts).
- **Hook di Claude Code**: un hook ha bloccato una modifica alle regole comuni mentre partiva un giro v2. Quel giro è stato rifatto, e da allora lo script stampa le issue di ogni tentativo.
- **Playwright** in Chrome headless, installato solo nello scratchpad, per verificare la UI: elenco, filtri, anteprime, 422, 503, Versioni.
- **MCP**: nessun server MCP compare nel log come parte del flusso.

## Revisione in corso

Una code review e una security review sono in corso in parallelo, in sola lettura. I loro risultati, e le eventuali correzioni, verranno aggiunti qui.
