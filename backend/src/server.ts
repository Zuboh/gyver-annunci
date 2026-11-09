import { createApp } from './app'
import { openDatabase } from './db/open-database'
import { createOpenAiLlmClient } from './llm/openai-llm-client'

const db = openDatabase(process.env.DB_PATH ?? 'backend/data/gyver.db')
// Without OPENAI_API_KEY the client answers every generation with LLM_UNAVAILABLE (503);
// reading and editing Ads still works.
const llm = createOpenAiLlmClient({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })
const port = Number(process.env.PORT ?? 3000)
// Local tool: loopback by default (HOST=0.0.0.0 to expose it). idleTimeout 255 s (Bun's max):
// Elysia's default of 30 s drops the socket during a Brief + Variant generation chain.
const hostname = process.env.HOST ?? '127.0.0.1'

createApp({ db, llm }).listen({ port, hostname, idleTimeout: 255 })
console.log(`Annunci in ascolto su http://${hostname}:${port}`)
