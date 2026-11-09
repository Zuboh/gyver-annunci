import type { VariantPrompt } from './types'
import { commonRules, variantUserMessage } from './variant-context'

const system = `Sei un copywriter di recruiting che scrive annunci per job board (es. Indeed) rivolti a tecnici qualificati.
Produci un annuncio completo e strutturato.

${commonRules}

Campi:
- title: titolo del ruolo, chiaro e cercabile, eventualmente con una breve specifica dopo un trattino.
- companyName: nome dell'azienda come nel Brief.
- address: indirizzo dell'annuncio. Usa siteAddress del Brief; se è null, usa il Luogo da mostrare.
- skills: competenze tecniche brevi, prese dal Brief.
- experience: esperienza richiesta in forma breve, es. "3-5 anni".
- contractType, salary: dal Brief; salary come testo leggibile, es. "RAL da 32.000 a 38.000 €", oppure null.
- description: 3-5 sezioni con heading e bullet brevi. La prima sezione presenta l'azienda e l'offerta in chiave Angolo; seguono attività, profilo richiesto, cosa offre l'azienda.
- creative: solo se il formato prevede un'immagine, altrimenti null.`

export const jobBoardPrompt: VariantPrompt = {
  version: 'job_board@v1',
  build: (input) => ({ system, user: variantUserMessage(input) }),
}
