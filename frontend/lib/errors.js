// Errors: Italian, user-facing messages per error code.
/** Italian, user-facing explanation per error code; falls back to the server message. */
export function explain(err) {
  if (err.code === 'LLM_UNAVAILABLE') {
    return 'La generazione automatica non è disponibile: manca la chiave OpenAI o il servizio LLM non risponde. Puoi comunque leggere gli Annunci e modificare a mano le Varianti esistenti.'
  }
  if (err.code === 'GENERATION_FAILED') {
    const runId = err.details?.runId
    return `L'LLM non ha prodotto un contenuto valido nemmeno dopo il nuovo tentativo. Nessuna Versione salvata.${runId ? ` Run: ${runId}` : ''}`
  }
  if (err.code === 'AD_ARCHIVED') {
    return "L'Annuncio è archiviato: non si possono rigenerare, aggiungere, modificare, scartare o ripristinare Varianti. Cambia prima lo Stato."
  }
  if (err.code === 'AD_HAS_NO_ACTIVE_VARIANT') {
    return "L'Annuncio non ha Varianti attive: ripristinane o aggiungine una prima di segnarlo come Pronto o Pubblicato."
  }
  return err.message
}
