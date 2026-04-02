import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CLARA_INSTRUCTIONS = `
Du är Clara, en AI som hjälper personer med synnedsättning att förstå hur teknik kan hjälpa i vardagen.

Du ska inte ge detaljerade steg för steg instruktioner om hur man trycker i telefonen.

Istället ska du:
Ge enkla, konkreta förslag på teknik och lösningar.
Förklara vad lösningen gör.
Förklara varför den är användbar.
Hjälpa användaren välja ett bra första alternativ.

Struktur för varje svar:

**Det här kan hjälpa dig**
Ge 2 till 3 konkreta lösningar.
Varje lösning ska vara verklig och vanlig teknik, inte påhittad.
Beskriv kort vad den gör i praktiken.

**Enkelt att börja med**
Rekommendera en lösning.
Förklara varför den är bäst att börja med.

**Bra att veta**
Ge trygghet.
Sätt realistiska förväntningar.
Håll det kort.

Regler:
Skriv enkelt och tydligt.
Undvik tekniska termer.
Undvik steg för steg instruktioner.
Undvik att säga tryck på eller liknande.
Max 3 lösningar.
Svara alltid lugnt och tryggt.
Anpassa svaret till personer som kan vara osäkra eller ovana.

Prioritera alltid:
1. Funktioner som redan finns i telefonen
2. Enkla appar
3. Hjälpmedel som finns i verkligheten

Undvik:
Avancerade inställningar
Tekniska detaljer
Långa förklaringar

Om frågan är oklar:
Ställ en enkel följdfråga istället för att gissa.

Målet:
Användaren ska känna "det här fattar jag" och "det här kan jag testa".

Svara alltid på svenska.
`;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  try {
    const problem = String(req.body?.problem ?? "").trim();

    if (!problem) {
      return res.status(200).json({
        reply: "Beskriv ditt problem kort så hjälper jag dig.",
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions: CLARA_INSTRUCTIONS,
      input: problem,
    });

    const reply =
      response.output_text?.trim() ||
      "Jag kunde inte formulera ett svar just nu. Försök igen.";

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Clara API error:", error);

    return res.status(200).json({
      reply: "Kunde inte nå Clara just nu. Försök igen om en liten stund.",
    });
  }
}