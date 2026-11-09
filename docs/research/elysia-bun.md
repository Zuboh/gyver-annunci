# Cheat sheet: Bun + Elysia + bun:sqlite + OpenAI + Preact/htm

> Regola per gli agenti: **leggi questo file prima di scrivere codice; non inventare API.**
> Se un'API non compare qui o nelle fonti linkate, verificala prima di usarla.
> Data di verifica: **2026-11-09**. Ogni affermazione ha la fonte accanto. Ciò che non è stato
> verificato è marcato **NON VERIFICATO**.

## 1. Versioni da fissare (pin)

Fonte: registry npm (`npm view <pkg> dist-tags`), eseguito il 2026-11-09.

| Pacchetto | Pin consigliato | Note |
|---|---|---|
| `bun` (runtime) | `>= 1.2`, consigliato `1.4.4` (latest) | `elysia@1.4.31` dichiara peer `@types/bun >= 1.2.0` |
| `elysia` | **`1.4.31`** (pin esatto) | ⚠ il dist-tag `latest` su npm punta a `2.0.0-rc.4` (una RC, pubblicata l'8/11/2026). **Non** fare `bun add elysia` senza versione. La 1.4 è l'ultima stabile |
| `@sinclair/typebox` | `0.34.x` | peer di `elysia@1.4.31` (`>= 0.34.0 < 1`); `t` di Elysia si basa su TypeBox |
| `@elysia/static` | `1.4.12` | nome usato ora dalla doc ufficiale e dal README; peer `elysia >= 1.4.0` |
| `@elysiajs/static` | `1.4.12` | nome storico, stessa versione pubblicata lo stesso giorno. Usane **uno solo** (consiglio `@elysia/static`, quello della doc) |
| `openai` | `7.53.0` | peer `zod: "^3.25 \|\| ^4.0"` |
| `zod` | `4.6.7` | **v4 supportata** dagli helper OpenAI (vedi §5) |
| `preact` | `11.2.0` | solo se si usa l'import map; la variante `htm/preact/standalone` include già Preact |
| `htm` | `3.1.1` | ultima release (invariata dal 2022) |

```bash
bun add elysia@1.4.31 @sinclair/typebox@0.34 @elysia/static@1.4.12 openai@7.53.0 zod@4.6.7
bun add -d @types/bun typescript
```

## 2. Elysia (1.4)

> La doc su elysiajs.com non dice per quale versione è scritta. Gli snippet qui sotto usano
> API presenti nella 1.4 (blog 1.4: https://elysiajs.com/blog/elysia-14.html).
> Il blog annuncia "Elysia 2 beta" (30 lug 2026), una riscrittura completa: ignora la doc 2.0.

### 2.1 App, route, parametri, prefisso

```ts
import { Elysia, t } from 'elysia'

new Elysia()
  .get('/ads', () => [])
  .get('/ads/:id', ({ params }) => params.id)
  .post('/ads', ({ body }) => body, { body: t.Object({ title: t.String() }) })
  .put('/ads/:id', ({ params, body }) => ({ id: params.id, ...body }))
  .patch('/ads/:id', ({ params }) => params.id)
  .listen(3000)
```

- I metodi chiamati `get/post/put/patch` e `.listen(port)`: https://elysiajs.com/essential/validation.html, https://elysiajs.com/patterns/unit-test.html
- Prefisso per l'istanza: `new Elysia({ prefix: '/v1' }).get('/name', ...)` → `/v1/name` (https://elysiajs.com/patterns/configuration.html#prefix)
- Raggruppare: `.group('/v1', (app) => app.post('/student', ...))` (https://elysiajs.com/essential/plugin.html)
- Proprietà del context: `body`, `query`, `params`, `headers`, `cookie`, `store`, `request`, `path`, più le utility `status`, `set`, `redirect` (https://elysiajs.com/essential/handler.html)

### 2.2 Validazione: `t` (TypeBox) o Zod (Standard Schema)

```ts
new Elysia()
  .post('/users/:id', ({ params, query, body }) => body, {
    params: t.Object({ id: t.Number() }),   // coerce automatica da stringa
    query: t.Object({ name: t.String() }),
    body: t.Object({ username: t.String() })
  })
```
Fonte: https://elysiajs.com/essential/validation.html

Zod funziona direttamente come schema di route **da Elysia 1.4** ("Elysia now supports Standard
Schema": Zod, Valibot, ArkType, Effect Schema, Joi…):

```ts
import { z } from 'zod'
new Elysia().post('/user/:id', ({ body, params }) => body, {
  params: z.object({ id: z.coerce.number() }),
  body: z.object({ name: z.string() })
})
```
Fonti: https://elysiajs.com/blog/elysia-14.html, https://elysiajs.com/essential/validation.html.
La doc non indica una versione minima di Zod (**NON VERIFICATO**: minimo esatto; Zod 4.x espone
Standard Schema).

**Raccomandazione**: usa `t` per body/query/params delle route (è il percorso nativo, e
`error.all` in `onError` è documentato su TypeBox). Usa Zod solo per lo schema dell'output LLM.
La forma di `error.all` quando lo schema è Zod è **NON VERIFICATO**.

### 2.3 Status code personalizzati

- **Corrente**: `status(code, body)` dal context, con narrowing dei tipi:
  `.get('/', ({ status }) => status(418, 'Kirifuji Nagisa'))` (https://elysiajs.com/essential/handler.html)
- `set.status = 418` è marcato **"Legacy"** nella doc (non inferisce il tipo di ritorno) ma funziona (stessa fonte).
- `error()` è stato **rimosso in 1.4**: "use `status` instead" (https://elysiajs.com/blog/elysia-14.html).
- `return status(...)` **non** passa da `onError`; `throw status(...)` **sì**
  (https://elysiajs.com/patterns/error-handling.html).

### 2.4 Gestore errori globale → `{ error: { code, message, details } }`

Codici built-in: `NOT_FOUND`, `PARSE`, `VALIDATION`, `INTERNAL_SERVER_ERROR`,
`INVALID_COOKIE_SIGNATURE`, `INVALID_FILE_TYPE`, `UNKNOWN`, oppure un numero (status HTTP).
Default per errori sconosciuti: `UNKNOWN` (https://elysiajs.com/essential/life-cycle.html).
Classi custom: si registrano con `.error({ MyError })` e il `code` in `onError` diventa il nome;
una proprietà `status = 418` sulla classe viene usata come status HTTP; opzionale `toResponse()`
(https://elysiajs.com/patterns/error-handling.html). `NotFoundError` è importabile da `'elysia'`
(https://elysiajs.com/essential/life-cycle.html). `error.all` è l'array degli errori di validazione,
con `path` tipo `/name` (https://elysiajs.com/essential/validation.html). Elysia usa 422 per gli
errori di validazione (https://elysiajs.com/tutorial/getting-started/status-and-headers/).

```ts
import { Elysia } from 'elysia'

export class AppError extends Error {
  constructor(
    public status: number,          // letto da Elysia come status HTTP
    public errorCode: string,       // NB: non chiamarlo `code` (vedi Pitfall)
    message: string,
    public details: unknown = null
  ) { super(message) }
}

const body = (code: string, message: string, details: unknown = null) =>
  ({ error: { code, message, details } })

export const errorHandler = new Elysia({ name: 'error-handler' })
  .error({ AppError })
  .onError({ as: 'global' }, ({ code, error, set }) => {
    switch (code) {
      case 'AppError':
        set.status = error.status   // status dinamico: set.status evita problemi di tipo
        return body(error.errorCode, error.message, error.details)
      case 'VALIDATION':
        set.status = 422
        return body('VALIDATION', 'Invalid request', error.all)
      case 'NOT_FOUND':
        set.status = 404
        return body('NOT_FOUND', 'Route not found')
      case 'PARSE':
        set.status = 400
        return body('PARSE', 'Malformed body')
      default:
        set.status = 500
        return body('INTERNAL', 'Unexpected error')
    }
  })
```
- `{ as: 'global' }` estende l'hook alle istanze che usano il plugin (https://elysiajs.com/key-concept.html); in
  alternativa registra `.onError(...)` **direttamente nell'app, prima delle route**.
- `return status(404, ...)` dentro `onError` è documentato (https://elysiajs.com/essential/life-cycle.html);
  `status()` con un numero non letterale potrebbe non tipizzare (**NON VERIFICATO**), quindi qui `set.status`.
- In `NODE_ENV=production` i dettagli di validazione nella risposta di default sono omessi
  (`Elysia.allowUnsafeValidationDetails = true` per riattivarli) (https://elysiajs.com/patterns/error-handling.html).
  Con un handler custom come sopra decidi tu cosa restituire.

### 2.5 Dependency injection: factory `createApp({ db, llm })`

Pattern più semplice: `decorate` (valori/servizi nel context). `state` invece finisce in `store`
ed è pensato per stato mutabile (https://elysiajs.com/integrations/cheat-sheet.html,
https://elysiajs.com/patterns/extends-context.html — `decorate({ a, b })` con oggetto è supportato).

```ts
import { Database } from 'bun:sqlite'
import { Elysia, file, t } from 'elysia'
import { staticPlugin } from '@elysia/static'

export interface LlmClient { extract(text: string): Promise<unknown> }

export function createApp(deps: { db: Database; llm: LlmClient }) {
  return new Elysia()
    .use(errorHandler)                       // prima delle route
    .decorate({ db: deps.db, llm: deps.llm })
    .group('/api', (app) => app
      .get('/ads', ({ db }) => db.query('SELECT * FROM ads').all())
      .post('/ads', ({ body, llm }) => llm.extract(body.text), {
        body: t.Object({ text: t.String({ minLength: 1 }) })
      }))
    .get('/', file('frontend/index.html'))   // import { file } from 'elysia' (§2.7)
    .use(staticPlugin({ assets: 'frontend', prefix: '/assets' }))
}

// backend/src/index.ts
// createApp({ db: new Database('data.sqlite'), llm: realClient }).listen(3000)
```
La catena di metodi è **obbligatoria** per l'inferenza dei tipi (vedi Pitfall).
Cosa fa `prefix: '/'` nello static plugin è **NON VERIFICATO**: per questo qui si usa `/assets` (§2.7).

### 2.6 Test con `app.handle(Request)`

```ts
const res = await app.handle(new Request('http://localhost/api/ads'))
const res2 = await app.handle(new Request('http://localhost/api/ads', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'Vendo bici' })
}))
expect(res2.status).toBe(200)
expect(await res2.json()).toEqual(/* ... */)
```
L'URL **deve essere completo** (`http://localhost/user`, non `/user`)
(https://elysiajs.com/patterns/unit-test.html). Non serve `.listen()` nei test.

### 2.7 File statici e `index.html` su `/`

Plugin: `import { staticPlugin } from '@elysia/static'`; `.use(staticPlugin())` (nessun `await` nell'esempio).
Opzioni (https://elysiajs.com/plugins/static.html):

| Opzione | Default | Significato |
|---|---|---|
| `assets` | `"public"` | cartella da esporre |
| `prefix` | `"/public"` | prefisso URL dei file |
| `indexHTML` | `false` | serve `index.html` per **qualsiasi** richiesta che non matcha né una route né un file |
| `ignorePatterns` | `[]` | file da escludere |
| `alwaysStatic` / `staticLimit` | `false` / `1024` | registrazione statica vs lazy delle route |
| `headers` | `{}` | header di risposta |

⚠ `indexHTML: true` è un fallback SPA: anche `/api/inesistente` restituirebbe l'HTML invece del
404 JSON. Per `/` la soluzione esplicita e documentata è la utility `file`:

```ts
import { Elysia, file } from 'elysia'
new Elysia()
  .get('/', file('frontend/index.html'))                      // https://elysiajs.com/essential/handler.html
  .use(staticPlugin({ assets: 'frontend', prefix: '/assets' })) // /assets/app.js ecc.
```
In alternativa `.get('/', () => Bun.file('./frontend/index.html'))` (https://elysiajs.com/blog/elysia-12.html).

## 3. bun:sqlite

Fonte unica: https://bun.com/docs/runtime/sqlite

```ts
import { Database } from 'bun:sqlite'

const db = new Database(':memory:', { strict: true })   // oppure new Database('data.sqlite', { strict: true })
db.run('PRAGMA foreign_keys = ON;')                       // per connessione: da eseguire a ogni apertura
db.run('PRAGMA journal_mode = WAL;')                       // consigliato dalla doc per file su disco
db.run(`
  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    attributes TEXT NOT NULL DEFAULT '{}'   -- JSON serializzato
  );
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    ad_id INTEGER NOT NULL REFERENCES ads(id) ON DELETE CASCADE
  );
`)                                        // run accetta più statement separati da ';'
```

- `db.exec` è un alias di `db.run`; `run` restituisce `{ lastInsertRowid, changes }`.
- `db.query(sql)` → `Statement` **in cache** (20 SQL più recenti); `db.prepare(sql)` → `Statement` **non** in cache, per SQL dinamico/one-shot.
- `.all()` → array di oggetti; `.get()` → primo oggetto o **`null`** se nessuna riga; `.run()` → `{ lastInsertRowid, changes }`; `.values()` → array di array.
- Parametri nominati: `$name`, `:name`, `@name`. Con `strict: true` puoi passare le chiavi **senza prefisso** e un parametro mancante **lancia errore**; senza `strict` un parametro mancante viene legato a `NULL` silenziosamente.
- `lastInsertRowid` è tipizzato `number | bigint` → usa `Number(...)`.
- `safeIntegers` default `false`: gli interi tornano `number` e oltre 2^53 vengono arrotondati. Con `true` tornano `bigint` (e `JSON.stringify` di un `bigint` fallisce: errore JS standard). Lascia il default.
- `.as(Class)` mappa le righe su una classe senza eseguire il costruttore.

```ts
const insertAd = db.query('INSERT INTO ads (title, attributes) VALUES ($title, $attributes)')
const { lastInsertRowid } = insertAd.run({ title: 'Bici', attributes: JSON.stringify({ km: 0 }) })
const id = Number(lastInsertRowid)

type AdRow = { id: number; title: string; attributes: string }
const row = db.query('SELECT * FROM ads WHERE id = $id').get({ id }) as AdRow | null
const ad = row && { ...row, attributes: JSON.parse(row.attributes) }   // JSON: parse manuale

// Transazione: la funzione deve essere SINCRONA; ritorna il valore di fn; rollback se lancia.
const insertMany = db.transaction((titles: string[]) => {
  for (const title of titles) insertAd.run({ title, attributes: '{}' })
  return titles.length
})
insertMany(['a', 'b'])     // annidata dentro un'altra transaction → savepoint
```
Varianti `.deferred/.immediate/.exclusive` disponibili. `close()` per chiudere.
⚠ Non mettere `await` (es. la chiamata LLM) dentro `db.transaction`: fn deve essere sincrona.

## 4. bun test

Fonti: https://bun.com/docs/test, https://bun.com/docs/test/lifecycle

```ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createApp } from '../src/app'

const fakeLlm = { extract: async () => ({ title: 'Bici', price: 100 }) }
let app: ReturnType<typeof createApp>

beforeEach(() => {
  const db = new Database(':memory:', { strict: true })
  // applica lo schema qui
  app = createApp({ db, llm: fakeLlm })
})

describe('GET /api/ads', () => {
  test('lista vuota', async () => {
    const res = await app.handle(new Request('http://localhost/api/ads'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
```

- File scoperti: `*.test.{ts,js,...}`, `*_test.*`, `*.spec.*`, `*_spec.*` (ricorsivo).
- Un file: `bun test ./backend/test/ads.test.ts` (il path deve iniziare con `./` o `/`).
- Per nome: `bun test -t "lista vuota"`; watch: `bun test --watch`; timeout default per test 5000 ms (`--timeout`).
- Niente mock: si iniettano i fake via `createApp`.

## 5. OpenAI Node SDK: structured outputs

Fonti: README e typings di `openai@7.53.0` (pacchetto npm, `README.md`, `helpers/zod.d.ts`,
`core/error.d.ts`), https://github.com/openai/openai-node,
https://developers.openai.com/api/docs/guides/structured-outputs

**Zod v3 o v4?** Gli helper in `openai/helpers/zod` accettano "schemas from `zod/v3`, `zod/v4`,
and `zod/v4-mini`" (JSDoc di `zodResponseFormat`/`zodTextFormat` in `helpers/zod.d.ts`); peer
`zod: ^3.25 || ^4.0`. Quindi `import { z } from 'zod'` con zod 4.6.7 va bene.

**Stable vs beta**: `client.chat.completions.parse(...)` e `client.responses.parse(...)` sono
metodi stabili (non `client.beta...`) in 7.53.0 (`resources/chat/completions/completions.d.ts`,
`resources/responses/responses.d.ts`). Il README indica la Responses API come "primary API";
Chat Completions è "supported indefinitely".

**Raccomandazione: Chat Completions + `zodResponseFormat`**: `message.parsed` e
`message.refusal` stanno sullo stesso oggetto, quindi il codice è più semplice da gestire e da fingere nei test.

```ts
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const AdExtraction = z.object({
  title: z.string(),
  price: z.number().nullable(),            // "opzionale" = nullable, NON .optional()
  category: z.enum(['auto', 'casa', 'altro']),
  tags: z.array(z.string())
})

const client = new OpenAI({ timeout: 20_000, maxRetries: 2 })   // apiKey da OPENAI_API_KEY

const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',   // usa un modello che supporta Structured Outputs
  messages: [
    { role: 'system', content: 'Extract ad fields.' },
    { role: 'user', content: text }
  ],
  response_format: zodResponseFormat(AdExtraction, 'ad_extraction')
})
const message = completion.choices[0]?.message
if (message?.refusal) throw new AppError(422, 'LLM_REFUSAL', message.refusal)
if (!message?.parsed) throw new AppError(502, 'LLM_EMPTY', 'No parsed output')
const data = message.parsed     // tipizzato come z.infer<typeof AdExtraction>
```

Alternativa con la Responses API:
```ts
import { zodTextFormat } from 'openai/helpers/zod'
const response = await client.responses.parse({
  model: 'gpt-5.5',
  input: text,
  text: { format: zodTextFormat(AdExtraction, 'ad_extraction') }
})
response.output_parsed   // ParsedT | null
// rifiuto: in response.output, item type 'message' → content item con type 'refusal'
```

**Restrizioni strict mode** (guida structured outputs):
- tutti i campi devono essere `required`; l'opzionalità si emula con unione con `null` → in Zod `.nullable()`.
  L'SDK **lancia** se usi `.optional()` senza `.nullable()` (`lib/transform.js` di openai@7.53.0).
- `additionalProperties: false` obbligatorio (l'helper lo genera).
- la radice deve essere un oggetto, non `anyOf`.
- tipi supportati: String, Number, Boolean, Integer, Object, Array, Enum, anyOf; `pattern`, `format`, `minimum`, `multipleOf`…
- non supportati: `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if/then/else`.
- limiti: 5000 proprietà, 10 livelli di nesting, 120.000 caratteri totali di nomi/enum.

**Errori** (`import OpenAI from 'openai'` → `OpenAI.APIError` ecc.; classi in `core/error.d.ts`):

| Status | Classe |
|---|---|
| 400 | `BadRequestError` |
| 401 | `AuthenticationError` |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `UnprocessableEntityError` |
| 429 | `RateLimitError` |
| >=500 | `InternalServerError` |
| N/A | `APIConnectionError` (timeout: `APIConnectionTimeoutError`) |

Tutte estendono `APIError` (`err.status`, `err.headers`, `err.requestID`). Esistono anche
`LengthFinishReasonError` e `ContentFilterFinishReasonError` (estendono `OpenAIError`, non `APIError`).
Retry automatici: 2 di default, su errori di connessione, 408, 409, 429, >=500 (`maxRetries`).
Timeout default **10 minuti** (`timeout` in ms); i timeout vengono ritentati. Entrambi
configurabili sul client o per richiesta (secondo argomento).

```ts
try { /* parse */ } catch (err) {
  if (err instanceof OpenAI.RateLimitError) throw new AppError(503, 'LLM_RATE_LIMIT', 'Retry later')
  if (err instanceof OpenAI.APIConnectionError) throw new AppError(504, 'LLM_UNREACHABLE', err.message)
  if (err instanceof OpenAI.APIError) throw new AppError(502, 'LLM_ERROR', err.message)
  throw err
}
```
(`OpenAI.RateLimitError`/`OpenAI.APIConnectionError` come proprietà statiche: il README mostra
`OpenAI.APIError` e `OpenAI.BadRequestError`; per le altre si presume lo stesso pattern, **NON VERIFICATO**.
Alternativa sicura: `import { RateLimitError } from 'openai'`, anch'essa **NON VERIFICATO**.)

## 6. Preact + htm da CDN (nessun build step)

**Opzione A (consigliata, un solo import)**: `htm/preact/standalone` esporta `html`, `render`,
`h`, `Component`, `createContext` e tutti gli hook (`useState`, `useEffect`, `useMemo`, `useRef`…)
(verificato sul bundle `preact/standalone.module.js` di htm@3.1.1; snippet ufficiale:
https://preactjs.com/guide/v11/getting-started, https://github.com/developit/htm). Il bundle
contiene la propria copia di Preact 10.x, non la 11 (versione esatta **NON VERIFICATO**).

```html
<div id="app"></div>
<script type="module">
  import { html, render, useState, useEffect } from 'https://esm.sh/htm@3.1.1/preact/standalone'

  function AdList() {
    const [ads, setAds] = useState([])
    const [error, setError] = useState(null)

    useEffect(() => {
      fetch('/api/ads')
        .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json()).error)))
        .then(setAds)
        .catch((e) => setError(e?.message ?? 'Errore'))
    }, [])

    if (error) return html`<p class="error">${error}</p>`
    return html`<ul>${ads.map((ad) => html`<li key=${ad.id}>${ad.title}</li>`)}</ul>`
  }

  render(html`<${AdList} />`, document.getElementById('app'))
</script>
```
URL equivalente unpkg: `https://unpkg.com/htm@3.1.1/preact/standalone.module.js` (README htm, lì senza versione).

**Opzione B (Preact 11)**: `import { h, render } from 'https://esm.sh/preact@11.2.0'`,
`import htm from 'https://esm.sh/htm@3.1.1'`, `const html = htm.bind(h)` (https://preactjs.com/guide/v11/getting-started).
Gli hook verrebbero da `https://esm.sh/preact@11.2.0/hooks`. Che esm.sh condivida un'unica
istanza di Preact tra i due URL è **NON VERIFICATO**: un'istanza duplicata rompe gli hook. Per
questo si consiglia l'opzione A.

Sintassi htm: componenti `<${Foo}>`, chiusura `<//>`, spread `<div ...${props}>` (README htm).

## 7. Pitfall documentati

1. **Usa sempre la catena di metodi.** "Elysia code should ALWAYS use method chaining"; se assegni
   l'istanza e chiami i metodi separatamente, i tipi di `state`/`decorate` si perdono (https://elysiajs.com/key-concept.html).
2. **Conta l'ordine.** Gli hook valgono solo per le route registrate **dopo**; "`onError` must be
   registered before the handler you want to apply it to" (https://elysiajs.com/essential/life-cycle.html).
3. **Incapsulamento.** Gli hook di un plugin sono locali di default; serve `{ as: 'global' }` per
   propagarli. "If you put the `onError` before plugin, plugin will not inherit the `onError` event"
   (https://elysiajs.com/key-concept.html, https://elysiajs.com/essential/life-cycle.html).
4. **Deduplica dei plugin.** Un plugin viene rieseguito per ogni istanza che lo usa, a meno di
   `new Elysia({ name: '...' })` (https://elysiajs.com/key-concept.html).
5. **`return status()` vs `throw status()`.** Solo il `throw` passa da `onError` (https://elysiajs.com/patterns/error-handling.html).
6. **`error()` non esiste più** in 1.4: usa `status()` (https://elysiajs.com/blog/elysia-14.html).
7. **`npm latest` di elysia è una RC 2.0**: fissa `1.4.31` (registry npm, 2026-11-09).
8. **`app.handle` vuole URL assoluti** (https://elysiajs.com/patterns/unit-test.html).
9. **`indexHTML: true`** trasforma ogni 404 in `index.html` (https://elysiajs.com/plugins/static.html).
10. **bun:sqlite**: senza `strict: true` un `$param` scritto male diventa `NULL` in silenzio; `.get()` restituisce `null`, non `undefined`;
    `db.transaction` richiede una funzione sincrona (https://bun.com/docs/runtime/sqlite).
11. **`PRAGMA foreign_keys = ON`** vale per singola connessione e va eseguito a ogni `new Database()`.
    Comportamento standard di SQLite (https://sqlite.org/foreignkeys.html), non documentato da Bun.
12. **OpenAI strict mode**: `.optional()` lancia; usa `.nullable()` (openai@7.53.0 `lib/transform.js`).
13. **Proprietà `code` sulle classi errore custom**: in questo file è rinominata `errorCode` per
    evitare collisioni con il `code` calcolato da Elysia. Il rischio è un'ipotesi, **NON VERIFICATO**.

## Fonti

- npm registry: `npm view elysia|@elysia/static|@elysiajs/static|openai|zod|preact|htm|bun dist-tags` e `peerDependencies` (2026-11-09)
- https://elysiajs.com/key-concept.html
- https://elysiajs.com/essential/handler.html
- https://elysiajs.com/essential/validation.html
- https://elysiajs.com/essential/life-cycle.html
- https://elysiajs.com/essential/plugin.html
- https://elysiajs.com/patterns/error-handling.html
- https://elysiajs.com/patterns/unit-test.html
- https://elysiajs.com/patterns/configuration.html
- https://elysiajs.com/patterns/extends-context.html
- https://elysiajs.com/integrations/cheat-sheet.html
- https://elysiajs.com/plugins/static.html
- https://elysiajs.com/blog/elysia-14.html
- https://elysiajs.com/blog/elysia-12.html
- https://elysiajs.com/blog.html
- https://elysiajs.com/tutorial/getting-started/status-and-headers/
- https://github.com/elysiajs/elysia-static
- https://github.com/elysiajs/documentation (via Context7)
- https://bun.com/docs/runtime/sqlite
- https://bun.com/docs/test
- https://bun.com/docs/test/lifecycle
- https://github.com/openai/openai-node e il pacchetto `openai@7.53.0` (README.md, helpers/zod.d.ts, core/error.d.ts, lib/transform.js)
- https://developers.openai.com/api/docs/guides/structured-outputs (redirect da platform.openai.com)
- https://preactjs.com/guide/v11/getting-started
- https://github.com/developit/htm e il pacchetto `htm@3.1.1` (preact/index.d.ts, preact/standalone.module.js)
- https://sqlite.org/foreignkeys.html
