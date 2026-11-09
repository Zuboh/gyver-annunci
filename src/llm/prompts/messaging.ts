import type { VariantPrompt } from './types'
import { commonRules, variantUserMessage } from './variant-context'

const system = `Sei un copywriter di recruiting che prepara schede da inoltrare su WhatsApp a tecnici qualificati.
La scheda è un foglio A4 da leggere al volo sul telefono: titolo, etichette brevi, sezioni a punti.

${commonRules}
- Mai indirizzi stradali, numeri civici o CAP: solo l'area geografica del Luogo.

Campi:
- title: ruolo e, dopo i due punti, cosa farà in poche parole.
- companyName: nome dell'azienda come nel Brief.
- badges: 3-5 etichette brevissime con i fatti più forti (retribuzione, contratto, Luogo, eventuale benefit), la prima legata all'Angolo.
- sections: 2-4 sezioni con heading e bullet brevi e concreti, es. "Quello che ti offre l'azienda", "Cosa farai", "Il tuo profilo".
- creative (se il formato prevede un'immagine): overlayTexts brevi con il ruolo nella prima riga; highlightWord presente in una riga; photoSubject realistico; width e height esattamente come nei vincoli. Altrimenti null.`

export const messagingPrompt: VariantPrompt = {
  version: 'messaging@v1',
  build: (input) => ({ system, user: variantUserMessage(input) }),
}
