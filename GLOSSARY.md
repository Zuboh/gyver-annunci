# Annunci

Sezione con cui il team Delivery di Gyver trasforma una Job Offer in contenuti pubblicabili sui diversi canali, per attirare tecnici qualificati.

## Linguaggio

### Input

**Job Offer** (`JobOffer`):
La posizione aperta presso un cliente, con tutte le informazioni in possesso di Gyver, anche quelle interne e non pubblicabili. Arriva da fuori ed è in sola lettura per questa sezione.
_Evita_: offerta, posizione, job description

**Brief** (`Brief`):
I fatti pubblicabili estratti da una Job Offer: cosa si può dire all'esterno, cosa no e quali sono i punti di forza. Uno per Job Offer, condiviso da tutti i suoi Annunci; si può rigenerare ma non modificare a mano.
_Evita_: riassunto, sintesi, job description interna

### Pubblicazione

**Annuncio** (`Ad`):
Contenuto destinato a un solo Canale, con un Formato e un Luogo, nato da una Job Offer. Un Luogo o un Formato diverso significa un Annuncio diverso.
_Evita_: inserzione, post, campagna, ad

**Stato** (`AdStatus`):
La fase in cui si trova un Annuncio: bozza, pronto, pubblicato, in pausa, archiviato. Lo cambia a mano il Team Delivery.
_Evita_: status di pubblicazione, fase

**Variante** (`Variant`):
Una delle alternative di contenuto di un Annuncio, messe a confronto per capire quale attrae di più. Comprende testo e Creative insieme. Può essere attiva o scartata.
_Evita_: versione, copy, test

**Angolo** (`angle`):
Il messaggio principale su cui punta una Variante (es. carriera, stipendio, multinazionale). Varianti dello stesso Annuncio hanno Angoli diversi.
_Evita_: tema, hook, taglio

**Versione** (`Version`):
Uno stato del contenuto di una Variante, immutabile. Ha un'Origine. Ogni modifica crea una nuova Versione; la corrente è l'ultima.
_Evita_: revisione, bozza, variante

**Origine** (`origin`):
Chi ha prodotto una Versione: l'LLM oppure il Team Delivery a mano.
_Evita_: fonte, autore

**Creative** (`Creative`):
La descrizione strutturata dell'immagine di una Variante: testi in sovrimpressione, parola evidenziata, soggetto della foto, dimensioni. Non è il file immagine.
_Evita_: immagine, grafica, asset, visual

### Canali

**Canale** (`Channel`):
Il luogo di pubblicazione di un Annuncio (Indeed, Instagram, TikTok, WhatsApp). Appartiene a un tipo: job board, ads social, messaggistica.
_Evita_: piattaforma, media, sorgente

**Formato** (`Format`):
La forma in cui esce un Annuncio: solo testo, solo immagine, immagine più testo.
_Evita_: tipo, layout, template

**Formato di Canale** (`ChannelFormat`):
Una combinazione Canale × Formato ammessa, con i suoi vincoli (lunghezze, dimensioni immagine, campi obbligatori).
_Evita_: configurazione, preset

**Luogo** (`AdLocation`):
Dove l'Annuncio dice che si lavora: un'etichetta mostrata al pubblico più i dati geografici (comune, provincia, regione, paese). Può differire dalla sede della Job Offer.
_Evita_: sede, indirizzo, location

### Persone

**Team Delivery**:
Gli account manager di Gyver che creano e gestiscono gli Annunci e presentano i tecnici ai clienti.
_Evita_: recruiter, utente, admin
