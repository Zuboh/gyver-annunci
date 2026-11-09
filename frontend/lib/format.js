// Labels (GLOSSARY.md) and date formatting.
export const STATUS_LABELS = {
  draft: 'Bozza',
  ready: 'Pronto',
  published: 'Pubblicato',
  paused: 'In pausa',
  archived: 'Archiviato',
}
export const FORMAT_LABELS = { text: 'Solo testo', image: 'Solo immagine', image_text: 'Immagine + testo' }
export const ORIGIN_LABELS = { llm: 'LLM', manual: 'Manuale' }

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
