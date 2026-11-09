// Seed data from the assignment PDF: Job Offer jo_001, the channel catalog and the three
// published examples (WhatsApp A4 card, Indeed text, social 1:1 creative).
// Length limits are editorial choices sized for readable copy, not verified platform limits.
import type {
  AdLocation,
  AdStatus,
  Channel,
  ChannelContent,
  ChannelFormat,
  ChannelFormatConstraints,
  Format,
  JobBoardContent,
  JobOfferPayload,
  MessagingContent,
  SocialAdContent,
} from '../domain/types'

export const JO_001: JobOfferPayload = {
  job_offer_id: 'jo_001',
  title: 'Tecnico elettricista fotovoltaico',
  company_name: 'AB Group SpA',
  status: 'active',
  created_at: '2026-02-08T20:05:13.000Z',
  location: {
    street_name: 'Via Artigianato',
    street_number: '27',
    postal_code: '25034',
    locality: 'Orzinuovi',
    province: 'Brescia',
    province_code: 'BS',
    region: 'Lombardia',
    country_code: 'IT',
  },
  contract_type: 'Tempo indeterminato',
  min_exp_years: 3,
  max_exp_years: 5,
  ral_min: 32000,
  ral_max: 38000,
  currency: 'EUR',
  required_skills: ['Fotovoltaico industriale', 'Cabine secondarie - MT/BT'],
  role_description:
    "**Carriera da Tecnico Fotovoltaico MT/BT — Costruisci una carriera nella costruzione e avviamento di grandi impianti**\n\nEntra all'interno della divisione dell'azienda specializzata nella realizzazione e manutenzione di grandi impianti fotovoltaici. Ti occuperai di:\n\n- Effettuare sopralluoghi tecnici in cantiere, raccogliere informazioni dal campo e definire lo stato di fatto, segnalare criticità tecniche e operative, proporre soluzioni tecniche da condividere con PM ed Engineering e redigere i report di sopralluogo\n- Supportare il coordinamento delle attività di montaggio delle strutture, moduli FV, cablaggi DC/AC e quadri elettrici effettuati da terze parti\n- Verificare la corretta esecuzione delle attività secondo disegni e indicazioni ricevute e segnalare scostamenti dal programma lavori\n- Eseguire le attività di collaudo attraverso verifiche preliminari, test funzionali, avviamento impianto e verifiche prestazionali\n- Supportare la verifica tecnica delle attività dei subappaltatori, segnalando non conformità o criticità e compilando le check list\n- Verificare il rispetto delle regole HSE sulle attività presidiate e segnalare situazioni di rischio, supportando il controllo qualità delle installazioni\n- Eseguire interventi in campo per la manutenzione in caso di guasti tecnici",
  location_and_hours:
    '- Trasferte giornaliere frequenti (senza indennità)\n- Sporadiche trasferte di più giorni (con indennità notturna)',
  company_description:
    "AB Group — multinazionale della cogenerazione e biogas\n\n- Fondato nel 1981 con sede centrale a Orzinuovi (Brescia), il Gruppo AB è l'azienda leader italiana nei settori della cogenerazione, biogas e rinnovabili\n- L'azienda conta oltre 1.700 dipendenti ed è presente in 20 Paesi tra Europa, Nord e Sud America\n- Il polo industriale principale si trova a Orzinuovi, su oltre 40.000 mq",
  requirements_description:
    '- Possiedi un diploma tecnico in elettrotecnica\n- Hai maturato almeno 3-4 anni di esperienza in installazione e avviamento di impianti FV\n- Sai leggere schemi elettrici e layout FV\n- Conosci inverter, BESS e strumentazione di verifica impianti FV\n- Hai maturato esperienza su impianti FV sopra i 100 kW\n- Hai esperienza su impianti di media tensione',
  compensation_package:
    "- RAL da 32.000 a 38.000 € in base all'esperienza\n- Indennità di 60 € lordi a notte per le trasferte multi-giorno\n- Ticket da 13 € per ogni giorno lavorato\n- Ore di viaggio oltre le 8 ore giornaliere pagate all'85% della paga base come da CCNL\n- Contratto a tempo indeterminato",
}

export const CHANNELS: Channel[] = [
  {
    id: 'indeed',
    name: 'Indeed',
    kind: 'job_board',
    toneGuidelines:
      "Tono professionale e completo, in seconda persona. Descrizione in sezioni con elenchi puntati: azienda e contratto, ruolo, cosa offre l'azienda, profilo richiesto. L'indirizzo della sede va solo nel campo indirizzo.",
  },
  {
    id: 'instagram',
    name: 'Instagram',
    kind: 'social_ad',
    toneGuidelines:
      "Tono diretto e informale, frasi brevi che si leggono in un secondo. Testi in sovrimpressione di poche parole con una parola chiave da evidenziare. Didascalia breve con invito a candidarsi. Mai l'indirizzo esatto: solo comune e provincia.",
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    kind: 'social_ad',
    toneGuidelines:
      "Tono energico e parlato, come un collega che ti racconta un'opportunità. Immagine verticale con testi in sovrimpressione cortissimi e una parola chiave evidenziata. Mai l'indirizzo esatto: solo comune e provincia.",
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    kind: 'messaging',
    toneGuidelines:
      "Tono diretto e amichevole, da tecnico a tecnico. Titolo chiaro, etichette brevi con i vantaggi chiave (RAL, contratto, crescita, luogo) e sezioni a punti essenziali. Mai l'indirizzo esatto: solo l'area geografica.",
  },
]

type ImageSize = NonNullable<ChannelFormatConstraints['image']>

const SQUARE: ImageSize = { width: 1080, height: 1080, aspectRatio: '1:1' }
const VERTICAL: ImageSize = { width: 1080, height: 1920, aspectRatio: '9:16' }
/** A4 at 150 dpi: the only ratio WhatsApp previews in full inside the chat (PDF note). */
const A4: ImageSize = { width: 1240, height: 1754, aspectRatio: 'A4' }

const socialConstraints = (image: ImageSize, captionMax: number, requiredFields: string[]): ChannelFormatConstraints => ({
  maxLength: {
    caption: captionMax,
    'hashtags.*': 40,
    callToAction: 30,
    'creative.overlayTexts.*': 40,
    'creative.highlightWord': 30,
    'creative.photoSubject': 200,
  },
  maxItems: { hashtags: 10, 'creative.overlayTexts': 4 },
  requiredFields,
  image,
})

const messagingConstraints = (image: ImageSize | null): ChannelFormatConstraints => ({
  maxLength: {
    title: 80,
    companyName: 60,
    'badges.*': 50,
    'sections.*.heading': 60,
    'sections.*.bullets.*': 160,
    'creative.overlayTexts.*': 60,
    'creative.photoSubject': 200,
  },
  maxItems: { badges: 6, sections: 5, 'sections.*.bullets': 6, 'creative.overlayTexts': 4 },
  requiredFields: ['title', 'companyName', 'badges', 'sections'],
  image,
})

export const CHANNEL_FORMATS: ChannelFormat[] = [
  {
    channelId: 'indeed',
    format: 'text',
    constraints: {
      maxLength: {
        title: 100,
        companyName: 100,
        address: 150,
        'skills.*': 60,
        experience: 40,
        contractType: 60,
        salary: 100,
        'description.*.heading': 100,
        'description.*.bullets.*': 250,
      },
      maxItems: { skills: 10, description: 8, 'description.*.bullets': 8 },
      requiredFields: ['title', 'companyName', 'address', 'skills', 'experience', 'description'],
      image: null,
    },
  },
  // Image only: the Creative carries the message, the caption is optional.
  { channelId: 'instagram', format: 'image', constraints: socialConstraints(SQUARE, 2200, []) },
  { channelId: 'instagram', format: 'image_text', constraints: socialConstraints(SQUARE, 2200, ['caption']) },
  { channelId: 'tiktok', format: 'image', constraints: socialConstraints(VERTICAL, 150, []) },
  { channelId: 'whatsapp', format: 'image_text', constraints: messagingConstraints(A4) },
  { channelId: 'whatsapp', format: 'text', constraints: messagingConstraints(null) },
]

export interface SeedAd {
  channelId: string
  format: Format
  status: AdStatus
  location: AdLocation
  angle: string
  content: ChannelContent
}

const ORZINUOVI: AdLocation = {
  label: 'Orzinuovi (BS)',
  municipality: 'Orzinuovi',
  province: 'Brescia',
  provinceCode: 'BS',
  region: 'Lombardia',
  country: 'IT',
}

const TITLE = 'Tecnico Fotovoltaico: coordinamento cantieri e manutenzione'

/** Body shared by the WhatsApp card and the Indeed description in the PDF. */
const DESCRIPTION_SECTIONS = [
  {
    heading: 'Assunzione diretta a tempo indeterminato in AB Group SpA',
    bullets: [
      'AB Group è una multinazionale con 1700 dipendenti e più di 40 anni di storia in impianti industriali, cogenerazione e fotovoltaico.',
      "L'opportunità di carriera rientra nel team di commissioning e manutenzione di impianti fotovoltaici presso i clienti di AB Group",
      'Sede centrale a Orzinuovi (Brescia) con trasferte giornaliere e sporadicamente di 2/3 giorni',
    ],
  },
  {
    heading: 'Carriera da capo cantiere fotovoltaico',
    bullets: [
      "Coordina l'installazione elettrica fotovoltaica e assicurati dell'avanzamento lavori insieme al PM",
      'Esegui collaudi e test funzionali su impianti di grandi dimensioni',
      'Esegui manutenzioni sul campo in caso di guasti',
    ],
  },
  {
    heading: "Quello che ti offrirà l'azienda:",
    bullets: [
      'Contratto a tempo indeterminato',
      "RAL iniziale da €38'000 + indennità",
      'Crescita a ruoli gestionali e possibile mobilità interna in altre divisioni',
    ],
  },
  {
    heading: 'Il tuo profilo:',
    bullets: [
      '3-5 anni di esperienza su installazione e avviamento fotovoltaici industriali (> 100 kW)',
      'Esperienza in MT',
      'Disponibilità a trasferte',
    ],
  },
]

const whatsappCard: MessagingContent = {
  title: TITLE,
  companyName: 'AB Group SpA',
  badges: [
    "RAL iniziale da €38'000 + indennità",
    'Tempo Indeterminato',
    'Crescita a site manager o mobilità interna',
    'Orzinuovi (BS) + trasferte',
    'Impianti fotovoltaici industriali',
  ],
  sections: DESCRIPTION_SECTIONS,
  creative: {
    overlayTexts: ['Tecnico Fotovoltaico:', 'coordinamento cantieri e manutenzione'],
    highlightWord: null,
    photoSubject: 'Logo AB Group "ABetter Way" in alto a sinistra su scheda bianca formato A4',
    width: A4.width,
    height: A4.height,
  },
}

const indeedPost: JobBoardContent = {
  title: TITLE,
  companyName: 'AB Group SpA',
  address: 'Via Artigianato, 27, 25034 Orzinuovi BS',
  skills: ['Fotovoltaico industriale', 'Cabine secondarie - MT/BT'],
  experience: '3-5 anni',
  contractType: 'Tempo indeterminato',
  salary: "RAL iniziale da €38'000 + indennità",
  description: DESCRIPTION_SECTIONS,
  creative: null,
}

const socialSquare: SocialAdContent = {
  caption: '',
  hashtags: [],
  callToAction: null,
  creative: {
    overlayTexts: ['Tecnico Fotovoltaico', 'ENTRA IN UNA MULTINAZIONALE', 'Impianti FV >100 kw'],
    highlightWord: 'Fotovoltaico',
    photoSubject:
      'Tecnico sorridente con casco bianco e giacca gialla ad alta visibilità davanti a pannelli fotovoltaici; loghi gyver × AB in alto',
    width: SQUARE.width,
    height: SQUARE.height,
  },
}

export const SEED_ADS: SeedAd[] = [
  {
    channelId: 'whatsapp',
    format: 'image_text',
    status: 'published',
    location: { ...ORZINUOVI, label: 'Orzinuovi (BS) + trasferte' },
    angle: 'carriera',
    content: whatsappCard,
  },
  { channelId: 'indeed', format: 'text', status: 'published', location: ORZINUOVI, angle: 'carriera', content: indeedPost },
  {
    channelId: 'instagram',
    format: 'image',
    status: 'published',
    location: ORZINUOVI,
    angle: 'multinazionale',
    content: socialSquare,
  },
]
