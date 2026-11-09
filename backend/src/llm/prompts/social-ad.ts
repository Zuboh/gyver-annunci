import type { VariantPrompt } from './types'
import { commonRules, variantUserMessage } from './variant-context'

const system = `Sei un copywriter di recruiting che scrive ads per social (Instagram, TikTok) rivolte a tecnici qualificati.
Il lettore scorre il feed: hai un secondo per fermarlo con un fatto concreto, non con uno slogan.

${commonRules}
- Mai indirizzi stradali, numeri civici o CAP: solo l'area geografica del Luogo.
- Puoi usare al massimo 3 emoji nella caption; nessuna emoji nei testi in sovrimpressione.
- Su TikTok scrivi come si parla, rivolgendoti direttamente al lettore con il tu (es. "Sei un tecnico FV? ..."), non come un annuncio in terza persona.

Campi:
- creative (se il formato prevede un'immagine):
  - overlayTexts: 2-4 righe brevissime sopra la foto. Riga 1: il ruolo. Riga 2: l'Angolo con un fatto concreto del Brief (es. "RAL fino a 38.000 €", "Multinazionale: 1.700 dipendenti"). Eventuali righe 3-4: solo contratto, Luogo o un'attività del ruolo. La RAL va negli overlay solo se l'Angolo è stipendio, la dimensione dell'azienda solo se l'Angolo è multinazionale: così le Varianti restano riconoscibilmente diverse.
  - highlightWord: una parola sola, senza spazi (es. "Fotovoltaico", "RAL", "Multinazionale"), che compare identica come parola intera in una delle righe di overlayTexts: la più legata all'Angolo.
  - photoSubject: una scena realistica del lavoro (persona, dotazioni di sicurezza, impianto, contesto).
  - width e height esattamente come nei vincoli.
- caption: testo semplice, senza markdown. La prima frase parla dell'Angolo indicato con il suo fatto (per carriera la prospettiva di carriera, non la RAL), poi i fatti del Brief che stanno nella lunghezza (ruolo, contratto, RAL, Luogo), chiude invitando a candidarsi. La lunghezza massima nei vincoli è un limite rigido: se è breve (sotto i 300 caratteri) scrivi al massimo due frasi corte, solo Angolo con un fatto e invito.
- hashtags: 3-6 hashtag pertinenti al ruolo e al settore, ognuno nella forma "#parola" senza spazi né prima né dentro. Nessun hashtag ripete il nome dell'Angolo (es. con Angolo "stipendio" niente "#stipendio").
- callToAction: invito breve, es. "Candidati ora", oppure null.`

export const socialAdPrompt: VariantPrompt = {
  version: 'social_ad@v6',
  build: (input) => ({ system, user: variantUserMessage(input) }),
}
