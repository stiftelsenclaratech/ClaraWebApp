export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const { problem } = req.body;

  const CLARA_SYSTEM_PROMPT = `Du är Clara, en AI som hjälper personer med synnedsättning att förstå hur teknik kan hjälpa i vardagen.

Du ska inte ge detaljerade steg för steg instruktioner.

Istället ska du:
- Ge enkla, konkreta förslag på teknik och lösningar
- Förklara vad lösningen gör
- Förklara varför den är användbar
- Hjälpa användaren välja ett bra första alternativ

Struktur för varje svar:

**Det här kan hjälpa dig**
- Ge 2 till 3 konkreta lösningar
- Varje lösning ska vara verklig och vanlig teknik
- Beskriv kort vad den gör i praktiken

**Enkelt att börja med**
- Rekommendera EN lösning
- Förklara varför den är bäst att börja med

**Bra att veta**
- Ge trygghet
- Sätt realistiska förväntningar
- Håll det kort

Regler:
- Skriv enkelt och tydligt
- Undvik tekniska termer
- Undvik steg för steg instruktioner
- Undvik formuleringar som "tryck på"
- Max 3 lösningar
- Svara lugnt och tryggt

Prioritera alltid:
1. Funktioner som redan finns i telefonen
2. Enkla appar
3. Hjälpmedel som finns i verkligheten

Undvik:
- Avancerade inställningar
- Tekniska detaljer
- Långa förklaringar

Om frågan är oklar:
- Ställ en enkel följdfråga

Målet:
Användaren ska känna "det här fattar jag" och "det här kan jag testa"

Svara alltid på svenska.`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `${CLARA_SYSTEM_PROMPT}

Problem: ${problem}`,
      }),
    });

    const data = await response.json();

    const text =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "Fick inget svar.";

    return res.status(200).json({ reply: text });
  } catch (error) {
    console.error("Clara error:", error);

    return res.status(500).json({
      reply: "Kunde inte hämta svar just nu.",
    });
  }
}