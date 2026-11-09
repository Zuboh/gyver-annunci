// User message shared by the channel prompts: Brief, Channel, ChannelFormat constraints, angle,
// location label and, on the retry, the issues of the previous attempt. Never the raw Job Offer.
import type { BriefContent } from '../../domain/types'
import type { GenerateVariantContentInput } from '../llm-client'

/** Only job_board content may show the street address: other kinds never receive it. */
function briefFor(input: GenerateVariantContentInput): BriefContent {
  if (input.channel.kind === 'job_board') return input.brief
  return { ...input.brief, siteAddress: null }
}

function constraintsText({ channelFormat }: GenerateVariantContentInput): string {
  const { maxLength, maxItems, requiredFields, image } = channelFormat.constraints
  const lines: string[] = []
  for (const [path, max] of Object.entries(maxLength)) {
    // Models overshoot character limits and count words better: on short fields ask for a
    // target at about 2/3 of the limit, with a word budget.
    const target = Math.floor((max * 2) / 3)
    const hint = max <= 300 ? ` (punta a circa ${target} caratteri, ${Math.max(2, Math.floor(target / 8))} parole)` : ''
    lines.push(`- ${path}: massimo ${max} caratteri${hint}`)
  }
  for (const [path, max] of Object.entries(maxItems)) lines.push(`- ${path}: massimo ${max} elementi`)
  if (requiredFields.length > 0) lines.push(`- campi obbligatori e non vuoti: ${requiredFields.join(', ')}`)
  if (image) {
    lines.push(
      `- creative obbligatoria: width ${image.width}, height ${image.height} (${image.aspectRatio}); highlightWord deve comparire in uno degli overlayTexts`,
    )
  } else {
    lines.push('- formato solo testo: creative = null')
  }
  lines.push('(i percorsi usano "*" per "ogni elemento della lista")')
  return lines.join('\n')
}

function feedbackText({ previousIssues }: GenerateVariantContentInput): string {
  if (!previousIssues || previousIssues.length === 0) return ''
  const issues = previousIssues.map((i) => `- ${i.path || '(radice)'}: ${i.message}`).join('\n')
  return `\n\n## Correzioni richieste\nIl tentativo precedente è stato scartato per questi problemi. Riscrivi il contenuto risolvendoli tutti, senza introdurne di nuovi:\n${issues}`
}

export function variantUserMessage(input: GenerateVariantContentInput): string {
  return `## Angolo
${input.angle}

## Luogo da mostrare
${input.location.label}

## Canale
${input.channel.name}. Linee guida di tono: ${input.channel.toneGuidelines}

## Formato e vincoli
Formato: ${input.channelFormat.format}
${constraintsText(input)}

## Brief (fatti pubblicabili, unica fonte ammessa)
${JSON.stringify(briefFor(input), null, 2)}${feedbackText(input)}`
}

/** Rules every channel prompt shares. */
export const commonRules = `Regole comuni:
- Scrivi in italiano, dando del tu al candidato. Il candidato ha già l'esperienza indicata nel Brief: parlagli da professionista, non da principiante (mai "inizia la tua carriera"). Parli a nome di Gyver, non dell'azienda: l'azienda è sempre in terza persona (mai "noi", "siamo", "offriamo", "cerchiamo").
- Usa solo i fatti del Brief: non inventare cifre, benefit, nomi o requisiti. Niente promesse generiche che il Brief non contiene (es. "crescita professionale", "ambiente internazionale", "opportunità uniche").
- Preferisci il fatto concreto all'aggettivo: numeri, tipo di impianti, attività precise.
- Non citare mai, nemmeno parafrasate, le voci di "doNotSay".
- Retribuzione: scrivila solo con i numeri di salary del Brief, in forma estesa con il punto delle migliaia e "€" (es. "RAL da 32.000 a 38.000 €"), mai abbreviata con "k".
- Il nome dell'azienda è companyName del Brief, identico.
- Il Luogo da mostrare è l'etichetta indicata, non altro. Se il Brief indica trasferte, citale in modo neutro.
- Costruisci il messaggio attorno all'Angolo indicato, usando i sellingPoints del Brief che lo sostengono: il titolo o la prima riga devono dare al tecnico un motivo concreto legato all'Angolo.
- Testo semplice: niente markdown (asterischi, cancelletti per titoli).
- Rispetta ogni vincolo di lunghezza e numero di elementi: è meglio un testo più corto che uno troncato.`
