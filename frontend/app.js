// Annunci UI: Preact + htm from a pinned CDN bundle, no build step.
// Hash routes: #/ (list), #/ads/:id (detail), #/new (create).
import { html, render, useState, useEffect, useCallback } from 'https://esm.sh/htm@3.1.1/preact/standalone'

// ---------------------------------------------------------------------------
// API layer: every non-2xx becomes an ApiError carrying the uniform { error: { code, message, details } }.
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, error) {
    super(error.message)
    this.status = status
    this.code = error.code
    this.details = error.details
  }
}

async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { code: 'NETWORK', message: 'Il server non risponde. Controlla che sia avviato.' })
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? { code: 'INTERNAL', message: `Errore HTTP ${res.status}.` })
  }
  return data
}

/** Path segment from an id (hash-derived ids are user-controlled): never splice it raw. */
const seg = (id) => encodeURIComponent(id)

const qs = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v)
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

// ---------------------------------------------------------------------------
// Labels (GLOSSARY.md)
// ---------------------------------------------------------------------------

const STATUS_LABELS = {
  draft: 'Bozza',
  ready: 'Pronto',
  published: 'Pubblicato',
  paused: 'In pausa',
  archived: 'Archiviato',
}
const FORMAT_LABELS = { text: 'Solo testo', image: 'Solo immagine', image_text: 'Immagine + testo' }
const ORIGIN_LABELS = { llm: 'LLM', manual: 'Manuale' }

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Italian, user-facing explanation per error code; falls back to the server message. */
function explain(err) {
  if (err.code === 'LLM_UNAVAILABLE') {
    return 'La generazione automatica non è disponibile: manca la chiave OpenAI o il servizio LLM non risponde. Puoi comunque leggere gli Annunci e modificare a mano le Varianti esistenti.'
  }
  if (err.code === 'GENERATION_FAILED') {
    const runId = err.details?.runId
    return `L'LLM non ha prodotto un contenuto valido nemmeno dopo il nuovo tentativo. Nessuna Versione salvata.${runId ? ` Run: ${runId}` : ''}`
  }
  if (err.code === 'AD_ARCHIVED') {
    return "L'Annuncio è archiviato: non si possono rigenerare, aggiungere, modificare, scartare o ripristinare Varianti. Cambia prima lo Stato."
  }
  if (err.code === 'AD_HAS_NO_ACTIVE_VARIANT') {
    return "L'Annuncio non ha Varianti attive: ripristinane o aggiungine una prima di segnarlo come Pronto o Pubblicato."
  }
  return err.message
}

function ErrorBanner({ error, onClose }) {
  if (!error) return null
  const issues = error.details?.issues
  return html`
    <div class="banner banner--error" role="alert">
      <div class="banner__head">
        <strong>${error.code ?? 'ERRORE'}${error.status ? ` · ${error.status}` : ''}</strong>
        ${onClose && html`<button class="btn btn--ghost btn--sm" onClick=${onClose} aria-label="Chiudi errore">Chiudi</button>`}
      </div>
      <p>${explain(error)}</p>
      ${Array.isArray(issues) &&
      issues.length > 0 &&
      html`<ul class="issues">
        ${issues.map((i) => html`<li><code>${i.path || '(radice)'}</code> ${i.message}</li>`)}
      </ul>`}
    </div>
  `
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function useHashRoute() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(location.hash || '#/')
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const Chip = ({ kind = '', children }) => html`<span class=${`chip ${kind ? `chip--${kind}` : ''}`}>${children}</span>`
const StatusChip = ({ status }) => html`<${Chip} kind=${`status-${status}`}>${STATUS_LABELS[status] ?? status}</${Chip}>`

/** Splits `text` around `word` (case-insensitive) and wraps the match in an orange span. */
function Highlight({ text, word }) {
  if (!word) return text
  const i = text.toLowerCase().indexOf(word.toLowerCase())
  if (i < 0) return text
  return html`${text.slice(0, i)}<span class="hl">${text.slice(i, i + word.length)}</span>${text.slice(i + word.length)}`
}

// ---------------------------------------------------------------------------
// Ads list
// ---------------------------------------------------------------------------

function AdList({ catalog }) {
  const [filters, setFilters] = useState({ job_offer_id: '', channel: '', status: '' })
  const [ads, setAds] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setError(null)
    api(`/api/ads${qs(filters)}`).then(setAds, setError)
  }, [filters.job_offer_id, filters.channel, filters.status])

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.currentTarget.value })

  return html`
    <section>
      <div class="page-head">
        <h1>Annunci</h1>
        <a class="btn btn--primary" href="#/new">Nuovo Annuncio</a>
      </div>
      <div class="filters">
        <label>Job Offer
          <select value=${filters.job_offer_id} onChange=${set('job_offer_id')}>
            <option value="">Tutte</option>
            ${catalog.jobOffers.map((jo) => html`<option value=${jo.id}>${jo.title} · ${jo.companyName}</option>`)}
          </select>
        </label>
        <label>Canale
          <select value=${filters.channel} onChange=${set('channel')}>
            <option value="">Tutti</option>
            ${catalog.channels.map((c) => html`<option value=${c.id}>${c.name}</option>`)}
          </select>
        </label>
        <label>Stato
          <select value=${filters.status} onChange=${set('status')}>
            <option value="">Tutti</option>
            ${Object.entries(STATUS_LABELS).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
          </select>
        </label>
      </div>
      <${ErrorBanner} error=${error} />
      ${ads === null && !error && html`<p class="muted">Caricamento…</p>`}
      ${ads?.length === 0 && html`<p class="muted">Nessun Annuncio con questi filtri.</p>`}
      <ul class="ad-grid">
        ${ads?.map(
          (ad) => html`
            <li>
              <a class="card ad-card" href=${`#/ads/${ad.id}`}>
                <div class="ad-card__title">${catalog.jobOfferById[ad.jobOfferId]?.title ?? ad.jobOfferId}</div>
                <div class="muted small">${catalog.jobOfferById[ad.jobOfferId]?.companyName}</div>
                <div class="chips">
                  <${Chip} kind="channel">${catalog.channelById[ad.channelId]?.name ?? ad.channelId}</${Chip}>
                  <${Chip}>${FORMAT_LABELS[ad.format] ?? ad.format}</${Chip}>
                  <${StatusChip} status=${ad.status} />
                  <${Chip}>${ad.location.label}</${Chip}>
                </div>
                <div class="muted small">
                  ${ad.activeVariantCount} Variant${ad.activeVariantCount === 1 ? 'e attiva' : 'i attive'} · aggiornato ${fmtDate(ad.updatedAt)}
                </div>
              </a>
            </li>
          `,
        )}
      </ul>
    </section>
  `
}

// ---------------------------------------------------------------------------
// Channel previews
// ---------------------------------------------------------------------------

function CreativeInfo({ creative }) {
  if (!creative) return null
  return html`
    <details class="creative-info">
      <summary>Creative · ${creative.width}×${creative.height}px</summary>
      <dl>
        <dt>Testi in sovrimpressione</dt><dd>${creative.overlayTexts.join(' / ')}</dd>
        <dt>Parola evidenziata</dt><dd>${creative.highlightWord ?? '—'}</dd>
        <dt>Soggetto della foto</dt><dd>${creative.photoSubject}</dd>
      </dl>
    </details>
  `
}

function WhatsAppPreview({ content, ad }) {
  // A4 page: the card is at least one page tall (ratio from the Creative, else A4) and grows if needed.
  const ratio = content.creative ? content.creative.height / content.creative.width : 297 / 210
  return html`
    <div class="pv-wa-wrap">
    <div class="pv-wa" style=${{ '--ratio': ratio }}>
      <div class="pv-wa__brand">${content.companyName}</div>
      <h3 class="pv-wa__title">${content.title}</h3>
      <div class="pv-wa__badges">
        ${content.badges.map((b) => html`<span class="pv-wa__badge">${b}</span>`)}
      </div>
      ${content.sections.map(
        (s) => html`
          <div class="pv-wa__section">
            <h4>${s.heading}</h4>
            <ul>${s.bullets.map((b) => html`<li>${b}</li>`)}</ul>
          </div>
        `,
      )}
      <div class="pv-wa__foot">${ad.location.label}</div>
    </div>
    </div>
  `
}

function SocialPreview({ content, ad }) {
  const cr = content.creative
  const fallback = ad.channelId === 'tiktok' ? '9 / 16' : '1 / 1'
  const ratio = cr ? `${cr.width} / ${cr.height}` : fallback
  // First overlay line = title, last = subline, anything between = badge(s).
  const lines = cr?.overlayTexts ?? []
  const [title, ...rest] = lines
  const subline = rest.length > 0 ? rest[rest.length - 1] : null
  const badges = rest.slice(0, -1)
  return html`
    <div class="pv-social-wrap">
      ${cr
        ? html`
            <div class=${`pv-social ${cr.height > cr.width ? 'pv-social--tall' : ''}`} style=${{ aspectRatio: ratio }}>
              <div class="pv-social__photo">Foto: ${cr.photoSubject}</div>
              <div class="pv-social__overlay">
                <div class="pv-social__title"><${Highlight} text=${title} word=${cr.highlightWord} /></div>
                ${badges.map((b) => html`<span class="pv-social__badge"><${Highlight} text=${b} word=${cr.highlightWord} /></span>`)}
                ${subline && html`<div class="pv-social__sub"><${Highlight} text=${subline} word=${cr.highlightWord} /></div>`}
                ${subline !== ad.location.label && html`<div class="pv-social__loc">${ad.location.label}</div>`}
              </div>
            </div>
          `
        : html`<p class="muted">Nessuna Creative in questa Versione.</p>`}
      <div class="pv-social__caption">
        ${content.caption ? html`<p>${content.caption}</p>` : html`<p class="muted">Nessuna didascalia.</p>`}
        ${content.callToAction && html`<span class="pv-social__cta">${content.callToAction}</span>`}
        ${content.hashtags.length > 0 &&
        html`<p class="pv-social__tags">${content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>`}
      </div>
    </div>
  `
}

function IndeedPreview({ content }) {
  return html`
    <article class="pv-indeed">
      <h3>${content.title}</h3>
      <div class="pv-indeed__company">${content.companyName}</div>
      <div class="pv-indeed__meta">${content.address}</div>
      <dl class="pv-indeed__facts">
        ${content.contractType && html`<dt>Contratto</dt><dd>${content.contractType}</dd>`}
        ${content.salary && html`<dt>Retribuzione</dt><dd>${content.salary}</dd>`}
        <dt>Esperienza</dt><dd>${content.experience}</dd>
        <dt>Competenze</dt><dd>${content.skills.join(', ') || '—'}</dd>
      </dl>
      <hr />
      ${content.description.map(
        (s) => html`
          <h4>${s.heading}</h4>
          <ul>${s.bullets.map((b) => html`<li>${b}</li>`)}</ul>
        `,
      )}
    </article>
  `
}

const PREVIEWS = { messaging: WhatsAppPreview, social_ad: SocialPreview, job_board: IndeedPreview }

function ChannelPreview({ content, ad, channel }) {
  const Preview = PREVIEWS[channel?.kind]
  return html`
    <div class="preview">
      ${Preview ? html`<${Preview} content=${content} ad=${ad} />` : html`<pre>${JSON.stringify(content, null, 2)}</pre>`}
      <${CreativeInfo} creative=${content.creative} />
    </div>
  `
}

// ---------------------------------------------------------------------------
// Ad detail
// ---------------------------------------------------------------------------

function VariantCard({ variant, ad, channel, onChanged, onError }) {
  const [versions, setVersions] = useState(null)
  const [shown, setShown] = useState(null) // a Version from history, or null = current
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [editError, setEditError] = useState(null)
  const [busy, setBusy] = useState(false)

  const current = variant.currentVersion
  const version = shown ?? current
  const frozen = ad.status === 'archived'

  const loadVersions = () =>
    api(`/api/variants/${seg(variant.id)}/versions`).then(
      (vs) => setVersions([...vs].sort((a, b) => b.number - a.number)),
      onError,
    )

  /** Runs a mutation, then reloads the Ad (and the history if it is open). */
  const run = async (fn, onFail = onError) => {
    setBusy(true)
    try {
      await fn()
      setShown(null)
      await onChanged()
      if (versions) await loadVersions()
      return true
    } catch (e) {
      onFail(e)
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = () =>
    run(() => api(`/api/variants/${seg(variant.id)}`, { method: 'PATCH', body: { active: !variant.active } }))
  const regenerate = () => run(() => api(`/api/variants/${seg(variant.id)}/regenerate`, { method: 'POST' }))

  const startEdit = () => {
    setDraft(JSON.stringify(current.content, null, 2))
    setEditError(null)
    setEditing(true)
  }

  const save = async () => {
    let content
    try {
      content = JSON.parse(draft)
    } catch (e) {
      setEditError({ code: 'JSON', message: `JSON non valido: ${e.message}` })
      return
    }
    setEditError(null)
    const ok = await run(() => api(`/api/variants/${seg(variant.id)}/content`, { method: 'PUT', body: { content } }), setEditError)
    if (ok) setEditing(false)
  }

  return html`
    <section class=${`card variant ${variant.active ? '' : 'variant--discarded'}`}>
      <header class="variant__head">
        <h2>Variante ${variant.label}</h2>
        <${Chip} kind="angle">Angolo: ${variant.angle}</${Chip}>
        <${Chip} kind=${variant.active ? 'active' : 'discarded'}>${variant.active ? 'Attiva' : 'Scartata'}</${Chip}>
        <span class="spacer"></span>
        <button class="btn btn--ghost btn--sm" disabled=${busy || frozen} onClick=${toggleActive}>
          ${variant.active ? 'Scarta' : 'Ripristina'}
        </button>
        <button class="btn btn--ghost btn--sm" disabled=${busy || frozen} onClick=${regenerate}>Rigenera con LLM</button>
        <button class="btn btn--ghost btn--sm" disabled=${busy || editing || frozen} onClick=${startEdit}>Modifica a mano</button>
      </header>

      <div class="version-line">
        <strong>Versione ${version.number}</strong>
        <${Chip} kind=${`origin-${version.origin}`}>${ORIGIN_LABELS[version.origin]}</${Chip}>
        <span class="muted small">
          ${fmtDate(version.createdAt)}${version.origin === 'llm' ? ` · ${version.model} · prompt ${version.promptVersion}` : ''}
        </span>
        ${shown && html`<button class="btn btn--ghost btn--sm" onClick=${() => setShown(null)}>Torna alla corrente</button>`}
      </div>

      ${editing
        ? html`
            <div class="editor">
              <label for=${`ed-${variant.id}`}>Contenuto (JSON). Salvando crei una nuova Versione manuale.</label>
              <textarea id=${`ed-${variant.id}`} rows="22" spellcheck="false" value=${draft} onInput=${(e) => setDraft(e.currentTarget.value)}></textarea>
              <${ErrorBanner} error=${editError} />
              <div class="row">
                <button class="btn btn--primary" disabled=${busy} onClick=${save}>Salva nuova Versione</button>
                <button class="btn btn--ghost" disabled=${busy} onClick=${() => setEditing(false)}>Annulla</button>
              </div>
            </div>
          `
        : html`<${ChannelPreview} content=${version.content} ad=${ad} channel=${channel} />`}

      <details class="history" onToggle=${(e) => e.currentTarget.open && !versions && loadVersions()}>
        <summary>Storico delle Versioni</summary>
        ${versions === null
          ? html`<p class="muted small">Caricamento…</p>`
          : html`<ol class="history__list">
              ${versions.map(
                (v) => html`
                  <li>
                    <button class="linklike" onClick=${() => setShown(v.number === current.number ? null : v)}>
                      Versione ${v.number}
                    </button>
                    <${Chip} kind=${`origin-${v.origin}`}>${ORIGIN_LABELS[v.origin]}</${Chip}>
                    <span class="muted small">${fmtDate(v.createdAt)}</span>
                    ${v.number === current.number && html`<span class="small">(corrente)</span>`}
                    ${v.number === version.number && html`<span class="small">· in anteprima</span>`}
                  </li>
                `,
              )}
            </ol>`}
      </details>
    </section>
  `
}

function AdDetail({ id, catalog }) {
  const [ad, setAd] = useState(null)
  const [error, setError] = useState(null)
  const [locLabel, setLocLabel] = useState('')
  const [newAngle, setNewAngle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      api(`/api/ads/${seg(id)}`).then((a) => {
        setAd(a)
        setLocLabel(a.location.label)
      }, setError),
    [id],
  )
  useEffect(() => {
    load()
  }, [load])

  const run = async (fn) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await load()
      return true
    } catch (e) {
      setError(e)
      return false
    } finally {
      setBusy(false)
    }
  }

  const patch = (body) => run(() => api(`/api/ads/${seg(id)}`, { method: 'PATCH', body }))

  const addVariant = async (e) => {
    e.preventDefault()
    const ok = await run(() => api(`/api/ads/${seg(id)}/variants`, { method: 'POST', body: { angle: newAngle.trim() } }))
    if (ok) setNewAngle('')
  }

  if (!ad) {
    return html`<section><a href="#/">← Annunci</a><${ErrorBanner} error=${error} />${!error && html`<p class="muted">Caricamento…</p>`}</section>`
  }

  const channel = catalog.channelById[ad.channelId]
  const jo = catalog.jobOfferById[ad.jobOfferId]
  const usedAngles = new Set(ad.variants.map((v) => v.angle))
  const archived = ad.status === 'archived'

  return html`
    <section>
      <a href="#/">← Annunci</a>
      <div class="page-head">
        <h1>${jo?.title ?? ad.jobOfferId}</h1>
      </div>
      <div class="chips">
        <${Chip} kind="channel">${channel?.name ?? ad.channelId}</${Chip}>
        <${Chip}>${FORMAT_LABELS[ad.format]}</${Chip}>
        <${StatusChip} status=${ad.status} />
        <${Chip}>${ad.location.label}</${Chip}>
      </div>
      <${ErrorBanner} error=${error} onClose=${() => setError(null)} />
      ${archived && html`<p class="muted small" role="status">Annuncio archiviato: le Varianti sono in sola lettura finché non cambi lo Stato.</p>`}

      <div class="card ad-meta">
        <label>Stato
          <select value=${ad.status} disabled=${busy} onChange=${(e) => patch({ status: e.currentTarget.value })}>
            ${Object.entries(STATUS_LABELS).map(([v, l]) => html`<option value=${v}>${l}</option>`)}
          </select>
        </label>
        <form class="inline-form" onSubmit=${(e) => {
          e.preventDefault()
          patch({ location: { ...ad.location, label: locLabel } })
        }}>
          <label>Luogo (etichetta pubblica)
            <input value=${locLabel} maxlength="80" onInput=${(e) => setLocLabel(e.currentTarget.value)} />
          </label>
          <button class="btn btn--ghost btn--sm" disabled=${busy || !locLabel.trim() || locLabel === ad.location.label}>Salva Luogo</button>
        </form>
        <div class="muted small">
          ${[ad.location.municipality, ad.location.provinceCode && `(${ad.location.provinceCode})`, ad.location.region, ad.location.country]
            .filter(Boolean)
            .join(' ')}
          · creato ${fmtDate(ad.createdAt)} · aggiornato ${fmtDate(ad.updatedAt)}
        </div>
      </div>

      ${ad.variants.map(
        (v) => html`<${VariantCard} key=${v.id} variant=${v} ad=${ad} channel=${channel} onChanged=${load} onError=${setError} />`,
      )}

      <form class="card inline-form" onSubmit=${addVariant}>
        <label>Nuova Variante con Angolo
          <input list="angle-suggestions" value=${newAngle} maxlength="60" placeholder="es. stipendio" disabled=${archived}
            onInput=${(e) => setNewAngle(e.currentTarget.value)} />
        </label>
        <datalist id="angle-suggestions">
          ${catalog.angles.filter((a) => !usedAngles.has(a)).map((a) => html`<option value=${a} />`)}
        </datalist>
        <button class="btn btn--primary btn--sm" disabled=${busy || archived || !newAngle.trim()}>Aggiungi Variante</button>
      </form>
    </section>
  `
}

// ---------------------------------------------------------------------------
// Create Ad
// ---------------------------------------------------------------------------

function CreateAd({ catalog }) {
  const [jobOfferId, setJobOfferId] = useState(catalog.jobOffers[0]?.id ?? '')
  const [channelId, setChannelId] = useState(catalog.channels[0]?.id ?? '')
  const formats = catalog.channelById[channelId]?.formats.map((f) => f.format) ?? []
  const [format, setFormat] = useState(formats[0] ?? '')
  const [locationLabel, setLocationLabel] = useState('')
  const [angles, setAngles] = useState([catalog.angles[0]].filter(Boolean))
  const [customAngle, setCustomAngle] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  const changeChannel = (id) => {
    setChannelId(id)
    // Keep the Formato valid for the chosen Canale.
    const allowed = catalog.channelById[id]?.formats.map((f) => f.format) ?? []
    if (!allowed.includes(format)) setFormat(allowed[0] ?? '')
  }

  const toggleAngle = (a) => setAngles(angles.includes(a) ? angles.filter((x) => x !== a) : [...angles, a])
  const addCustom = () => {
    const a = customAngle.trim()
    if (a && !angles.includes(a)) setAngles([...angles, a])
    setCustomAngle('')
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setFailed(null)
    setBusy(true)
    const body = { job_offer_id: jobOfferId, channel: channelId, format }
    if (locationLabel.trim()) body.location = { label: locationLabel.trim() }
    if (angles.length) body.angles = angles
    try {
      const res = await api('/api/ads', { method: 'POST', body })
      if (res.failedAngles.length) setFailed({ adId: res.ad.id, list: res.failedAngles })
      else location.hash = `#/ads/${res.ad.id}`
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const allAngles = [...new Set([...catalog.angles, ...angles])]

  return html`
    <section>
      <a href="#/">← Annunci</a>
      <h1>Nuovo Annuncio</h1>
      <p class="muted">Crei un Annuncio in bozza e l'LLM genera una Variante per ogni Angolo scelto (da 1 a 3).</p>
      <${ErrorBanner} error=${error} onClose=${() => setError(null)} />
      ${failed &&
      html`<div class="banner banner--warn" role="status">
        <p>Annuncio creato, ma alcuni Angoli non sono stati generati:</p>
        <ul class="issues">
          ${failed.list.map((f) => html`<li><strong>${f.angle}</strong>: ${explain(f.error)}</li>`)}
        </ul>
        <a class="btn btn--primary btn--sm" href=${`#/ads/${failed.adId}`}>Apri l'Annuncio</a>
      </div>`}
      <form class="card form" onSubmit=${submit}>
        <label>Job Offer
          <select value=${jobOfferId} onChange=${(e) => setJobOfferId(e.currentTarget.value)}>
            ${catalog.jobOffers.map((jo) => html`<option value=${jo.id}>${jo.title} · ${jo.companyName}</option>`)}
          </select>
        </label>
        <label>Canale
          <select value=${channelId} onChange=${(e) => changeChannel(e.currentTarget.value)}>
            ${catalog.channels.map((c) => html`<option value=${c.id}>${c.name}</option>`)}
          </select>
        </label>
        <label>Formato
          <select value=${format} onChange=${(e) => setFormat(e.currentTarget.value)}>
            ${formats.map((f) => html`<option value=${f}>${FORMAT_LABELS[f] ?? f}</option>`)}
          </select>
        </label>
        <label>Luogo (facoltativo)
          <input value=${locationLabel} maxlength="80" placeholder="Se vuoto: dalla sede della Job Offer, es. Orzinuovi (BS)"
            onInput=${(e) => setLocationLabel(e.currentTarget.value)} />
        </label>
        <fieldset>
          <legend>Angoli (${angles.length}/3)</legend>
          ${allAngles.map(
            (a) => html`<label class="check">
              <input type="checkbox" checked=${angles.includes(a)} disabled=${!angles.includes(a) && angles.length >= 3}
                onChange=${() => toggleAngle(a)} /> ${a}
            </label>`,
          )}
          <div class="row">
            <input aria-label="Altro Angolo" placeholder="Altro Angolo" maxlength="60" value=${customAngle}
              onInput=${(e) => setCustomAngle(e.currentTarget.value)} />
            <button type="button" class="btn btn--ghost btn--sm" disabled=${!customAngle.trim() || angles.length >= 3} onClick=${addCustom}>Aggiungi</button>
          </div>
        </fieldset>
        <button class="btn btn--primary" disabled=${busy || !format || angles.length === 0}>
          ${busy ? 'Generazione in corso…' : 'Crea e genera'}
        </button>
      </form>
    </section>
  `
}

// ---------------------------------------------------------------------------
// App shell: loads the catalog (Job Offers, Channels, Angles) once.
// ---------------------------------------------------------------------------

function App() {
  const hash = useHashRoute()
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api('/api/job-offers'), api('/api/channels'), api('/api/angles')]).then(
      ([jobOffers, channels, angles]) =>
        setCatalog({
          jobOffers,
          channels,
          angles,
          jobOfferById: Object.fromEntries(jobOffers.map((j) => [j.id, j])),
          channelById: Object.fromEntries(channels.map((c) => [c.id, c])),
        }),
      setError,
    )
  }, [])

  let page
  if (!catalog) page = error ? null : html`<p class="muted">Caricamento…</p>`
  else if (hash === '#/new') page = html`<${CreateAd} catalog=${catalog} />`
  else if (hash.startsWith('#/ads/')) {
    const id = decodeURIComponent(hash.slice('#/ads/'.length))
    page = html`<${AdDetail} key=${id} id=${id} catalog=${catalog} />`
  } else page = html`<${AdList} catalog=${catalog} />`

  return html`
    <header class="topbar">
      <a class="topbar__brand" href="#/">Annunci</a>
      <span class="muted small">Team Delivery</span>
    </header>
    <main class="container">
      <${ErrorBanner} error=${error} />
      ${page}
    </main>
  `
}

render(html`<${App} />`, document.getElementById('app'))
