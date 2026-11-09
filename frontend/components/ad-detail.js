// Ad detail: Ad metadata, Variants and their Version history.
import { html, useState, useEffect, useCallback } from '../lib/preact.js'
import { api, seg } from '../lib/api.js'
import { STATUS_LABELS, FORMAT_LABELS, ORIGIN_LABELS, fmtDate } from '../lib/format.js'
import { ChannelPreview } from './previews/index.js'
import { Chip, StatusChip, ErrorBanner } from './ui.js'

export function VariantCard({ variant, ad, channel, onChanged, onError }) {
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
        <${Chip} kind="angle">Focus: ${variant.angle}</${Chip}>
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

export function AdDetail({ id, catalog }) {
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
        <label>Nuova Variante con Focus
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
