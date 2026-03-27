export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const { problem } = req.body;

  const CLARA_SYSTEM_PROMPT = `Du är Clara.

Du hjälper personer med synnedsättning att lösa vardagsproblem med teknik.

Regler:
Ge alltid ett konkret första steg som användaren själv kan göra direkt med sin egen teknik.
Undvik att första steget kräver hjälp av andra personer.
Du måste alltid ge teknikförslag.
Prioritera telefonen först om det är möjligt.
Prioritera kamera, röststyrning, sensorer och automatisering.
Ge inte allmänna råd utan teknik.
Svara kort, tydligt och konkret.

Struktur:
Problem
kort tolkning

Första steg
konkret handling direkt

Fler möjligheter
2 till 3 korta idéer

Teknik
konkreta exempel`;

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
  } catch {
    return res.status(500).json({ reply: "Fel vid anrop." });
  }
}