# Judge report: prompt v4 (jo_001)

This report was written by `agent-channel-judge` in read-only mode, scoring the samples in `docs/samples/*@v4/`. Rubric: 7 criteria scored 0–2. A sample is accepted when no criterion is 0 and the average is at least 1.5. All six samples share the same Brief (brief@v4). The model was gpt-4o-mini-2024-07-18.

**Confidentiality sweep.** Searched for `senza indennità`, `85%`, `ore di viaggio`, `Artigianato`, `25034`, `noi`, `offriamo`, `cerchiamo`. The only hit is the street address inside Indeed's `address` field, where it is allowed. Every string is within its `maxLength` and every image matches its format size.

## Scores

| Sample (angle) | Struttura | Vincoli | Tono | Riservatezza | Fedeltà | Angolo | Aggancio | Avg | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| indeed-text (retribuzione) | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 1.71 | accepted |
| instagram-image (dimensione dell'azienda) | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2.00 | accepted |
| instagram-image_text (tipo impianti) | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 1.71 | accepted |
| tiktok-image (retribuzione) | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 1.71 | accepted |
| whatsapp-text (tipo impianti) | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1.71 | accepted |
| whatsapp-image_text (dimensione dell'azienda) | 2 | 2 | 1 | 2 | **0** | 1 | 2 | 1.43 | **rejected** |

## Key evidence

- **whatsapp-image_text, Fedeltà 0.** The copy says "Indennità di 60 € per le trasferte." next to "Sede a Orzinuovi (Brescia) con trasferte multi-giorno." The Job Offer pays 60 € gross per night only on multi-day trips; frequent daily trips carry no allowance. The card generalises the benefit, so the ad states the opposite of a do-not-say fact. A candidate would find this out at interview. The title and overlay also push plant type instead of the assigned angle.
- **instagram-image_text.** `highlightWord` is a phrase, "Impianti sopra i 100 kW". The overlay says "RAL da 38.000 €", which reads as a 38k minimum; the caption says the range is 32–38k.
- **indeed-text.** Two bullets end with a comma. The voice mixes third person ("Effettua", "Verifica") with second person ("Esegui"). The angle appears only in the title.
- **tiktok-image.** The tone is a flat listing, not spoken. The hashtag `#retribuzione` leaks the angle name. The overlay stacks all three angles at once.
- **whatsapp-text.** The first badge belongs to a different angle, and the badges are identical to the image_text variant. The hook is generic.
- **instagram-image.** Clean: "Multinazionale: 1.700 dipendenti" with a single-word highlight. Close to the PDF example.

## Overall

- 5 of 6 accepted. Confidentiality holds in every sample.
- The real risk is the opposite of a leak: copy that paraphrases a benefit too loosely and so contradicts the hidden conditions.
- The generator's self-reported weaknesses are confirmed: highlightWord as a phrase, angle names that are too long, "RAL da <max>", and trailing commas.
- Problems the generator did not report:
  - mixed grammatical person, inherited from the Brief's `responsibilities`;
  - weak differentiation between variants;
  - TikTok tone.

## Prioritized fixes

1. **Benefits keep their condition** (prompt plus validation). Write "60 € lordi a notte per le trasferte di più giorni" in full; never generalise it. Validation flags "indennit…" when "notte" or "più giorni" is missing.
2. **Salary wording** (validation plus prompt). Reject "da X" when X > ral_min, and a bare "RAL X" when X = ral_max. Only "fino a <max>", "da <min>" or the full range pass.
3. **highlightWord is a single word** (schema plus validation). Enforce `/^\S+$/` and check the overlay with whole-word matching.
4. **Each angle owns the hook** (prompt):
   - Brief angles are 1–2 words, and `sellingPoints[i]` matches `angles[i]`.
   - On WhatsApp, the title and the first badge carry the angle.
   - Social overlays do not repeat the other angles' facts.
5. **Normalise copied text** (prompt):
   - Brief `responsibilities` use the second person.
   - Indeed bullets end with a period.
   - TikTok is spoken and addresses the reader as "tu".
   - No hashtag repeats the angle name.
