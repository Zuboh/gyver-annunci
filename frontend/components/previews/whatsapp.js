// WhatsApp (messaging) preview.
import { html } from '../../lib/preact.js'

export function WhatsAppPreview({ content, ad }) {
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
