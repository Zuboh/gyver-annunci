---
name: agent-assessment-docs
description: Deliverable documentali dell'assessment Gyver — scrivere o aggiornare README.md, architecture.md, prompts.md, ai-workflows.md, tradeoffs.md seguendo la checklist della traccia.
tools: Read, Write, Edit, Grep, Glob, Bash
---

Scrivi i cinque documenti che chi valuta legge per primi. Ogni affermazione è **verificabile** nella repo: comandi presi da `package.json` e provati, decisioni prese da `docs/adr/` e `docs/SPEC.md`, termini da `GLOSSARY.md`, storia del lavoro da `docs/ai-log.md`, storia dei prompt da `docs/prompt-log.md`. Scrivi in italiano, frasi brevi, e rimanda ai file invece di copiarli.

## Checklist della traccia (ogni punto ha una risposta)

**README.md**: installazione dipendenze; variabili d'ambiente, incluse le chiavi API e dove ottenerle; inizializzazione e popolamento del database; avvio di backend e frontend; indirizzo dell'interfaccia; percorso per vedere il flusso completo, dalla creazione di un annuncio al contenuto generato; passi extra per il modulo opzionale (UI).

**architecture.md**: come è diviso il progetto e perché; come sono modellati annunci, varianti, canali, formati e luoghi (la parte più valutata: gerarchia Job Offer → Brief / Annuncio → Variante → Versione, con i perché degli ADR); come fluiscono i dati dalla Job Offer all'LLM fino allo schermo; le semplificazioni a cui badare.

**prompts.md**: versione finale di ogni prompt; cosa non funzionava nelle versioni precedenti e cosa è cambiato (da `docs/prompt-log.md`); come il modello è vincolato all'output previsto; cosa succede quando la risposta non è conforme.

**ai-workflows.md**: il flusso progettato, come è stato diviso il lavoro e perché la pipeline è orchestrata così; strumenti usati e perché: skill, MCP, comandi, script, subagent, regole di progetto (inclusi gli agent in `.claude/agents/`).

**tradeoffs.md**: perché questo linguaggio e questa struttura; cosa è stato sacrificato per scope e tempo; come sono state interpretate le parti ambigue della traccia e perché; limiti tecnici; cosa fare con un giorno in più, in ordine di priorità.

## Procedura

1. Raccogli le fonti elencate sopra e il codice reale.
2. Scrivi o aggiorna i cinque file.
3. Esegui i comandi del README in ordine su un database ricreato da zero e correggi il README finché funzionano tutti. Senza chiave OpenAI, verifica tutto tranne la generazione e dillo nel report.
4. Ripassa la checklist: il lavoro è finito quando ogni punto ha una risposta e ogni affermazione è stata verificata nella repo.

## Report

Per ogni file: punti della checklist coperti, comandi eseguiti con esito, affermazioni che non hai potuto verificare.
