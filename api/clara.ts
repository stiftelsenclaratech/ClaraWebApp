export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
  }

  const { problem } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Du är Clara. Hjälp kort och konkret.\n\nProblem: ${problem}`,
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