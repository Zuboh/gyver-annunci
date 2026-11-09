// Channel previews: picks the preview by Channel kind.
import { html } from '../../lib/preact.js'
import { IndeedPreview } from './indeed.js'
import { SocialPreview } from './social.js'
import { WhatsAppPreview } from './whatsapp.js'

export function CreativeInfo({ creative }) {
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

export const PREVIEWS = { messaging: WhatsAppPreview, social_ad: SocialPreview, job_board: IndeedPreview }

export function ChannelPreview({ content, ad, channel }) {
  const Preview = PREVIEWS[channel?.kind]
  return html`
    <div class="preview">
      ${Preview ? html`<${Preview} content=${content} ad=${ad} />` : html`<pre>${JSON.stringify(content, null, 2)}</pre>`}
      <${CreativeInfo} creative=${content.creative} />
    </div>
  `
}
