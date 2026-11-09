# Frontend

UI degli Annunci: Preact + htm da CDN, moduli ES, nessun build step. La serve il backend: `/` restituisce `index.html`, il resto sta sotto `/assets/` (per esempio `/assets/app.js`). Basta `bun run dev` dalla radice della repo.

## File

| File | Contenuto |
|---|---|
| [`index.html`](index.html), [`styles.css`](styles.css) | Pagina e stili |
| [`app.js`](app.js) | Entry: router a hash (`#/`, `#/ads/:id`, `#/new`), caricamento del catalogo, `App` |
| [`lib/preact.js`](lib/preact.js) | L'unico import dal CDN (`htm@3.1.1/preact/standalone`, versione fissata), riesportato |
| [`lib/api.js`](lib/api.js) | `api()`, `ApiError`, `seg()`, `qs()`: tutte le chiamate a `/api/*` passano da qui |
| [`lib/format.js`](lib/format.js) | Etichette di Stato, Formato, origine e formato delle date |
| [`lib/errors.js`](lib/errors.js) | `explain()`: messaggio in italiano per codice di errore |
| [`components/ui.js`](components/ui.js) | `Chip`, `StatusChip`, `Highlight`, `ErrorBanner` |
| [`components/ad-list.js`](components/ad-list.js) | Elenco degli Annunci con filtri |
| [`components/ad-detail.js`](components/ad-detail.js) | Dettaglio dell'Annuncio, Varianti e storico delle Versioni |
| [`components/ad-create.js`](components/ad-create.js) | Form di creazione |
| [`components/previews/`](components/previews/) | Anteprima per tipo di Canale: WhatsApp, social, Indeed |

Serve la connessione a internet per `esm.sh` e Google Fonts.
