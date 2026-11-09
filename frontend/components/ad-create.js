// Create Ad form.
import { html, useState } from '../lib/preact.js'
import { api } from '../lib/api.js'
import { explain } from '../lib/errors.js'
import { FORMAT_LABELS } from '../lib/format.js'
import { ErrorBanner } from './ui.js'

export function CreateAd({ catalog }) {
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
