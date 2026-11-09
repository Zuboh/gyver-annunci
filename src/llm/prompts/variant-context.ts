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
  for (const [path, max] of Object.entries(maxLength)) lines.push(`- ${path}: massimo ${max} caratteri`)
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
- Scrivi in italiano, dando del tu al candidato.
- Usa solo i fatti del Brief: non inventare cifre, benefit, nomi o requisiti.
- Non citare mai, nemmeno parafrasate, le voci di "doNotSay".
- Se citi la retribuzione, usa esattamente i valori di salary del Brief.
- Il Luogo da mostrare è l'etichetta indicata, non altro.
- Costruisci il messaggio attorno all'Angolo indicato: deve essere il primo motivo che il lettore incontra.
- Rispetta ogni vincolo di lunghezza e numero di elementi: è meglio un testo più corto che uno troncato.`
