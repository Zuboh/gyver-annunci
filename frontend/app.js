// Annunci UI: Preact + htm from a pinned CDN bundle, no build step.
// Hash routes: #/ (list), #/ads/:id (detail), #/new (create).
import { html, render, useState, useEffect } from './lib/preact.js'
import { api } from './lib/api.js'
import { AdDetail } from './components/ad-detail.js'
import { CreateAd } from './components/ad-create.js'
import { AdList } from './components/ad-list.js'
import { ErrorBanner } from './components/ui.js'

function useHashRoute() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(location.hash || '#/')
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

// App shell: loads the catalog (Job Offers, Channels, Angles) once.
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
