// Social ad preview (Instagram, Facebook, TikTok).
import { html } from '../../lib/preact.js'
import { Highlight } from '../ui.js'

export function SocialPreview({ content, ad }) {
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
