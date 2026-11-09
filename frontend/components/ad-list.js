// Ads list with filters.
import { html, useState, useEffect } from '../lib/preact.js'
import { api, qs } from '../lib/api.js'
import { STATUS_LABELS, FORMAT_LABELS, fmtDate } from '../lib/format.js'
import { Chip, StatusChip, ErrorBanner } from './ui.js'

export function AdList({ catalog }) {
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
