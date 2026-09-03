import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Lättviktig hälsokontroll för extern övervakning (t.ex. UptimeRobot).
//
// En tidigare version anropade bara Googles modell-metadata (GET, ingen
// generering) för att undvika kostnad - men det visade sig INTE räcka:
// den kvoten är separat från själva svarsgenereringen, så kontrollen
// svarade "ok" 2026-09-03 trots att riktiga chattsvar redan misslyckades
// med 429 "prepayment credits depleted". En hälsokontroll som inte
// upptäcker det faktiska felet är värdelös.
//
// Den här versionen gör därför en riktig, men mikroskopisk, generering
// (maxOutputTokens 5, inget "tänkande", inget systemprompt, ingen sökning)
// för att faktiskt testa samma kvot som appen använder - till en bråkdel
// av kostnaden för ett riktigt svar.

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json(body: Record<string, unknown>): void;
  };
};

type ApiRequest = {
  method?: string;
};

function getErrorStatusCode(error: unknown, depth = 0): number | null {
  if (!error || typeof error !== "object" || depth > 4) {
    return null;
  }

  const record = error as Record<string, unknown>;

  for (const key of ["statusCode", "status"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  for (const key of ["cause", "error", "response", "body", "data", "lastError"]) {
    const nested = getErrorStatusCode(record[key], depth + 1);
    if (nested !== null) {
      return nested;
    }
  }

  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) {
      const nestedStatusCode = getErrorStatusCode(nested, depth + 1);
      if (nestedStatusCode !== null) {
        return nestedStatusCode;
      }
    }
  }

  return null;
}

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
    const google = createGoogleGenerativeAI({ apiKey });

    await generateText({
      model: google("gemini-flash-latest"),
      prompt: "hej",
      maxOutputTokens: 5,
      maxRetries: 0,
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
    });

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    // Detaljerna loggas server-side, aldrig till den som anropar
    // hälsokontrollen.
    console.error("Clara health check misslyckades:", error);

    const statusCode = getErrorStatusCode(error);

    if (statusCode === 429) {
      return res.status(503).json({ status: "error", reason: "QUOTA_EXCEEDED" });
    }

    if (statusCode === 401 || statusCode === 403) {
      return res.status(503).json({ status: "error", reason: "INVALID_KEY" });
    }

    return res.status(503).json({ status: "error", reason: "GOOGLE_API_ERROR" });
  }
}
