// Job board preview (Indeed).
import { html } from '../../lib/preact.js'

export function IndeedPreview({ content }) {
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
