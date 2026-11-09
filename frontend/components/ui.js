// Shared bits: chips, highlight, error banner.
import { html } from '../lib/preact.js'
import { explain } from '../lib/errors.js'
import { STATUS_LABELS } from '../lib/format.js'

export const Chip = ({ kind = '', children }) => html`<span class=${`chip ${kind ? `chip--${kind}` : ''}`}>${children}</span>`
export const StatusChip = ({ status }) => html`<${Chip} kind=${`status-${status}`}>${STATUS_LABELS[status] ?? status}</${Chip}>`

/** Splits `text` around `word` (case-insensitive) and wraps the match in an orange span. */
export function Highlight({ text, word }) {
  if (!word) return text
  const i = text.toLowerCase().indexOf(word.toLowerCase())
  if (i < 0) return text
  return html`${text.slice(0, i)}<span class="hl">${text.slice(i, i + word.length)}</span>${text.slice(i + word.length)}`
}

export function ErrorBanner({ error, onClose }) {
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
