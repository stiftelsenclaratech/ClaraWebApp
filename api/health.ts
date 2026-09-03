// Lättviktig hälsokontroll för extern övervakning (t.ex. UptimeRobot).
// Anropar ALDRIG Gemini för att generera ett svar - det skulle kosta
// pengar per kontroll och tömma samma kvot som appen själv använder.
// Istället hämtas bara modellens metadata, vilket inte är en betald
// generering.

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: Record<string, unknown>): void;
  };
};

type ApiRequest = {
  method?: string;
};

const GOOGLE_MODEL_INFO_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ status: "error", reason: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

  if (!apiKey) {
    return res.status(503).json({ status: "error", reason: "MISCONFIGURED" });
  }

  try {
    const response = await fetch(`${GOOGLE_MODEL_INFO_URL}?key=${apiKey}`, {
      method: "GET",
    });

    if (response.ok) {
      return res.status(200).json({ status: "ok" });
    }

    // 429 = kvoten/krediten är slut, 4xx för nyckeln = fel/återkallad nyckel.
    // Detaljerna loggas server-side, aldrig till den som anropar hälsokontrollen.
    console.error("Clara health check misslyckades:", response.status);

    if (response.status === 429) {
      return res.status(503).json({ status: "error", reason: "QUOTA_EXCEEDED" });
    }

    return res.status(503).json({ status: "error", reason: "GOOGLE_API_ERROR" });
  } catch (error) {
    console.error("Clara health check kunde inte nå Google:", error);
    return res.status(503).json({ status: "error", reason: "UNREACHABLE" });
  }
}
