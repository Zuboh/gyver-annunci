# Canali come dati, forma del contenuto nel codice

Canali e combinazioni Canale × Formato ammesse, con i loro vincoli, vivono nel database. La forma del contenuto generato (schema di validazione e prompt) vive nel codice, una per tipo di canale (job board, ads social, messaggistica). Così un nuovo canale di un tipo già noto (es. LinkedIn come job board) si aggiunge con una riga, senza migrazioni. Un tipo nuovo richiede codice, ma richiederebbe comunque un prompt nuovo.

## Considered Options

- Enum nel codice per canali e formati: più semplice, ma ogni canale nuovo è un deploy, e i vincoli non sono interrogabili.
- Schema del contenuto interamente nel DB (JSON Schema editabile): massima flessibilità, ma prompt e validazione si scollegano e il tempo dell'assessment non lo giustifica.
