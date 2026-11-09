import { createApp } from './app'
import { openDatabase } from './db/open-database'
import { createOpenAiLlmClient } from './llm/openai-llm-client'

const db = openDatabase(process.env.DB_PATH ?? 'data/gyver.db')
// Without OPENAI_API_KEY the client answers every generation with LLM_UNAVAILABLE (503);
// reading and editing Ads still works.
const llm = createOpenAiLlmClient({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
const port = Number(process.env.PORT ?? 3000)

createApp({ db, llm }).listen(port)
console.log(`Annunci in ascolto su http://localhost:${port}`)
