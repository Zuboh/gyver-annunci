# AI log (materiale grezzo per ai-workflows.md e prompts.md)

## 2026-11-09 — Pianificazione e modellazione
- Piano scritto in plan mode con Claude Code (Opus 5.5); domande su stack, LLM, workflow risolte con AskUserQuestion.
- Stack scelto: Bun + Elysia, Preact + htm da CDN, bun:sqlite, OpenAI structured outputs.
- Design token letti dal CSS pubblico di gyver.work (palette, Archivo/DM Sans).
- Modellazione con skill Matt Pocock `grill-with-docs` (= `grilling` + `domain-modeling`): 3 round, 20 decisioni, output GLOSSARY.md + 3 ADR.
- Nota: le skill `grill-with-docs`, `to-spec`, `implement` hanno disable-model-invocation → vanno lanciate dall'umano.

## 2026-11-09 — Spec e agent di progetto
- `to-spec` (Matt Pocock) → docs/SPEC.md: 49 user story, schema, contratto API. Seam di test concordato: un solo seam HTTP (`createApp({db, llm})`) + `LlmClient` finto.
- 3 subagent in `.claude/agents/` scritti con `writing-for-agents`: prompt-engineer (iterazioni versionate + prompt-log), channel-judge (rubrica 7 criteri, giudice separato dal generatore), assessment-docs (checklist della traccia).
- Ricerca Elysia/Bun/OpenAI delegata a un agent in background con skill `research` → docs/research/elysia-bun.md (fonti primarie).
