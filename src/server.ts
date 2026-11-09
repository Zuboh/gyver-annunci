import { createApp } from './app'
import { openDatabase } from './db/open-database'
import { createUnavailableLlmClient } from './llm/llm-client'

const db = openDatabase(process.env.DB_PATH ?? 'data/gyver.db')
// TODO(llm): use the OpenAI LlmClient when OPENAI_API_KEY is set (implemented in a later step).
const llm = createUnavailableLlmClient('Il client LLM non è ancora configurato.')
const port = Number(process.env.PORT ?? 3000)

createApp({ db, llm }).listen(port)
console.log(`Annunci in ascolto su http://localhost:${port}`)
