export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const { problem } = req.body;

  const CLARA_SYSTEM_PROMPT = `Du är Clara.

Du hjälper personer med synnedsättning att lösa vardagsproblem med teknik.

Regler:
Ge alltid ett enkelt och vardagsnära första förslag som användaren själv kan testa direkt.
Börja helst med sådant som redan finns i användarens telefon.
Prioritera telefonen först om det är möjligt.
Prioritera röstassistent, kamera, uppläsning, sensorer och automatisering.
Ge alltid teknikförslag.
Undvik allmänna råd utan teknik.
Undvik långa förklaringar.
Svara kort, tydligt och konkret.
Svara alltid på svenska.

Struktur:
Problem
Kort tolkning av vad användaren vill lösa.

Första steg
Det enklaste och mest vardagsnära teknikförslaget.
Det ska ofta vara något i telefonen eller via röstassistent.

Fler möjligheter
2 till 3 korta idéer.
De ska vara verkliga, enkla och användbara.

Teknik
Konkreta exempel på funktioner, appar eller hjälpmedel.

Viktigt:
Börja inte med avancerade hjälpmedel om telefonen kan räcka.
Låt svaret kännas lugnt, enkelt och möjligt att testa direkt.
Undvik detaljerade steg för steg instruktioner om knapptryckningar.`;

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