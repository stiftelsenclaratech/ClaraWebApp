import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

type ConversationRole = "user" | "assistant";

type ConversationMessage = {
  role: ConversationRole;
  content: string;
};

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "BUDGET_EXCEEDED"
  | "RATE_LIMITED"
  | "MISCONFIGURED"
  | "SERVICE_UNAVAILABLE"
  | "SERVER_ERROR";

const MAX_OUTPUT_TOKENS = 900;
const MAX_CONTEXT_MESSAGES = 8;
const MAX_CONTEXT_CHARS = 700;
const MAX_LATEST_MESSAGE_CHARS = 1200;

const CLARA_SYSTEM_INSTRUCTION = `Du är Clara.

Du hjälper personer med synnedsättning att lösa vardagsproblem med teknik.

Regler:
Språket ska vara korrekt och bra svenska med rätt benämningar.
Ge alltid ett första förslag som är det enklaste som faktiskt fungerar för användarens problem.
Det första förslaget får vara antingen en inbyggd funktion eller en app, beroende på vad som är enklast och mest användbart i praktiken.
Välj inte inbyggda funktioner bara för att de är inbyggda om en enkel app är ett bättre första val.
Prioritera lösningar som användaren själv kan testa direkt i vardagen.
Ge alltid teknikförslag.

Undvik allmänna råd utan teknik.
Undvik långa förklaringar.
Svara kort, tydligt och konkret.
Svara alltid på svenska.
Om användaren ställer en följdfråga ska du bygga vidare på tidigare samtal.
Svara på användarens senaste meddelande, men använd hela samtalet som sammanhang.
Upprepa inte hela tidigare svaret om det inte behövs för att användaren ska förstå.

Svarsläge:
Om det är användarens första fråga i samtalet ska du använda den fasta strukturen nedan.
Om det är en följdfråga ska du svara direkt på frågan i friare form.
Vid följdfrågor behöver du inte använda de fasta rubrikerna.
Vid följdfrågor får du skriva ett kort direkt svar, eller en kort lista om det hjälper, men håll svaret tydligt och naturligt.
Vid följdfrågor ska du fortfarande hålla dig inom samma område: teknik som hjälper personer med synnedsättning i vardagen.

Struktur för första svaret:
Använd vanliga rubriker i ren text.
Använd inte markdown i svaret.
Skriv aldrig tecken som *, #, _, eller \` för formatering.
Börja direkt med rubriken Problem.
Skriv ingen hälsning och ingen lös inledningsmening före Problem.

Problem
Kort tolkning av vad användaren vill lösa just nu.

Första steg
Det enklaste teknikförslaget som faktiskt fungerar för problemet.
Det får vara en inbyggd funktion i telefonen eller en app, beroende på vad som är enklast och mest hjälpsamt.

Fler möjligheter
2 till 3 korta idéer.
De ska vara verkliga, enkla och användbara.

Teknik
Konkreta exempel på funktioner, appar eller hjälpmedel.
Ge 1 till 3 konkreta exempel med länk när det är möjligt.
Använd hela URL:er (https://...).
Välj i första hand officiella länkar, till exempel appens officiella sida eller App Store/Google Play.
Skriv tydligt vilken plattform länken gäller, till exempel: "App Store (iOS)" eller "Google Play (Android)".
Låt varje app eller tjänst och dess länk vara i samma punkt eller samma rad.
Lägg inte länken som en egen punkt eller på en egen rad utan sammanhang.
Använd inte punktlistor för mellanrubriker som iPhone, Android eller Appar.
Om du delar upp efter plattform, skriv plattformens namn som en vanlig rad och lägg själva förslagen under den.
Om du använder underrubriker som iPhone, Android eller Appar ska de stå ensamma på en egen rad och vara tydliga.
När du länkar till App Store ska du använda den direkta appsidan på apps.apple.com för just appen, inte söksidor eller allmänna informationssidor.

Viktigt:
Börja inte med avancerade hjälpmedel om telefonen kan räcka.
Låt svaret kännas lugnt, enkelt och möjligt att testa direkt.
Nämn aldrig språk för en app om det inte efterfrågas.
Nämn språk endast om du är säker på att appen saknar svenska, och skriv då kort: "Finns inte på svenska."
Om du är osäker på språkstöd, skriv inget om språk.
Undvik detaljerade steg för steg instruktioner om knapptryckningar.
Om extern sökning inte behövs ska du hålla dig till dina instruktioner och svara utan att hitta externa källor.
Om extern sökning används ska du bara använda den för att hitta eller verifiera specifika länkar och aktuell information.`;

function sendError(res: any, status: number, code: ApiErrorCode, reply: string) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ code, reply });
}

function truncateText(value: string, limit: number) {
  const trimmedValue = value.trim();
  if (trimmedValue.length <= limit) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, limit).trimEnd()}...`;
}

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || "";
}

function normalizeMessages(input: unknown): ConversationMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((message) => {
    if (
      !message ||
      typeof message !== "object" ||
      !("role" in message) ||
      !("content" in message)
    ) {
      return [];
    }

    const role = message.role;
    const content = message.content;

    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      content.trim() === ""
    ) {
      return [];
    }

    return [{ role, content: content.trim() }];
  });
}

function buildPrompt(messages: ConversationMessage[], latestUserMessage: string) {
  const userMessageCount = messages.filter(
    (message) => message.role === "user"
  ).length;
  const isFirstQuestion = userMessageCount <= 1;
  const contextMessages = messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message, index, slicedMessages) => {
      const isLatestMessage = index === slicedMessages.length - 1;
      const limit =
        message.role === "user" && isLatestMessage
          ? MAX_LATEST_MESSAGE_CHARS
          : MAX_CONTEXT_CHARS;

      return {
        ...message,
        content: truncateText(message.content, limit),
      };
    });

  const conversationContext = contextMessages
    .map((message) => {
      const speaker = message.role === "assistant" ? "Clara" : "Användaren";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return `${isFirstQuestion ? "Detta är användarens första fråga i samtalet." : "Detta är en följdfråga i ett pågående samtal."}

Samtalet hittills:
${conversationContext}

Användarens senaste meddelande:
${truncateText(latestUserMessage, MAX_LATEST_MESSAGE_CHARS)}

Svara nu som Clara.
${isFirstQuestion ? "Använd den fasta strukturen för första svaret." : "Svara friare och direkt på följdfrågan utan att tvinga in svaret i den fasta första-svarsstrukturen."}`;
}

function shouldUseGoogleSearch(
  messages: ConversationMessage[],
  latestUserMessage: string
) {
  const normalizedMessage = latestUserMessage.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  if (
    /^(hej|hejsan|hallå|god morgon|god kväll|tack|tusen tack|toppen|super|bra|okej|ok|ja|nej|mm+|japp|näpp)([.!? ]+)?$/i.test(
      normalizedMessage
    )
  ) {
    return false;
  }

  const asksForLinks =
    /\b(länk|länkar|link|app store|google play|hemsida|webbplats|officiell|officiella|hämta|installera|ladda ner|download|url)\b/i.test(
      latestUserMessage
    );
  const asksForCurrentInfo =
    /\b(senaste|nyaste|idag|just nu|aktuell|uppdaterad|pris|kostar|abonnemang|version|kompatibel|finns det|vilken app finns)\b/i.test(
      latestUserMessage
    );
  const asksForVerification =
    /\b(sök|sök upp|kolla upp|kontrollera|verifiera|hitta)\b/i.test(
      latestUserMessage
    );
  const asksForSpecificAppRecommendation =
    /\b(vilken|vilka|någon|några|tips|förslag)\b[\s\S]{0,40}\b(app|appar|hjälpmedel|tjänst|tjänster)\b/i.test(
      latestUserMessage
    );
  const namesSpecificProducts =
    /\b(voiceover|talkback|be my eyes|seeing ai|google lens|envision|supersense|iphone|ios|android)\b/i.test(
      latestUserMessage
    );

  if (asksForLinks || asksForCurrentInfo || asksForVerification) {
    return true;
  }

  if (asksForSpecificAppRecommendation && namesSpecificProducts) {
    return true;
  }

  return false;
}

function collectErrorTexts(error: unknown, depth = 0): string[] {
  if (error == null || depth > 4) {
    return [];
  }

  if (typeof error === "string") {
    return [error];
  }

  if (error instanceof Error) {
    return [
      error.message,
      ...collectErrorTexts((error as Error & { cause?: unknown }).cause, depth + 1),
    ];
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    const texts: string[] = [];

    for (const key of ["message", "statusText", "details", "code"]) {
      const value = record[key];
      if (typeof value === "string") {
        texts.push(value);
      }
    }

    for (const key of ["cause", "error", "response", "body", "data"]) {
      texts.push(...collectErrorTexts(record[key], depth + 1));
    }

    return texts;
  }

  return [];
}

function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const record = error as Record<string, unknown>;

  for (const key of ["statusCode", "status"]) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  for (const key of ["cause", "error", "response", "body", "data"]) {
    const nestedStatusCode = getErrorStatusCode(record[key]);
    if (nestedStatusCode !== null) {
      return nestedStatusCode;
    }
  }

  return null;
}

function isBudgetExceededError(error: unknown) {
  const statusCode = getErrorStatusCode(error);
  const normalizedText = collectErrorTexts(error).join(" ").toLowerCase();

  return (
    statusCode === 429 ||
    ((statusCode === 403 || statusCode === 400) &&
      /(resource[_ -]?exhausted|quota|billing|budget|rate limit|too many requests)/i.test(
        normalizedText
      ))
  );
}

function isTemporaryProviderError(error: unknown) {
  const statusCode = getErrorStatusCode(error);

  return (
    statusCode === 408 ||
    statusCode === 425 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504
  );
}

async function generateWithGoogle(
  prompt: string,
  useSearch: boolean,
  apiKey: string
) {
  const google = createGoogleGenerativeAI({
    apiKey,
  });

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    // In AI SDK for Google, `system` is translated to Gemini `systemInstruction`.
    system: CLARA_SYSTEM_INSTRUCTION,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    temperature: 0.1,
    topP: 0.1,
    topK: 1,
    providerOptions: {
      google: {
        responseModalities: ["TEXT"],
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    },
    ...(useSearch
      ? {
          tools: {
            google_search: google.tools.googleSearch({
              searchTypes: { webSearch: {} },
            }),
          },
          activeTools: ["google_search"] as const,
          toolChoice: "auto" as const,
        }
      : {
          toolChoice: "none" as const,
        }),
  });

  return text || "Fick inget svar.";
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return sendError(res, 405, "INVALID_REQUEST", "Endast POST stöds.");
  }

  const googleApiKey = getGoogleApiKey();

  if (!googleApiKey) {
    return sendError(
      res,
      500,
      "MISCONFIGURED",
      "Tjänsten är inte korrekt konfigurerad."
    );
  }

  const { problem, messages } = req.body ?? {};
  const normalizedMessages = normalizeMessages(messages);

  if (!normalizedMessages.length && typeof problem === "string" && problem.trim()) {
    normalizedMessages.push({
      role: "user",
      content: problem.trim(),
    });
  }

  const latestUserMessage = [...normalizedMessages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content;

  if (!latestUserMessage) {
    return sendError(
      res,
      400,
      "INVALID_REQUEST",
      "Beskriv ditt problem kort så hjälper jag dig."
    );
  }

  const prompt = buildPrompt(normalizedMessages, latestUserMessage);
  const useSearch = shouldUseGoogleSearch(normalizedMessages, latestUserMessage);

  try {
    const reply = await generateWithGoogle(prompt, useSearch, googleApiKey);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Clara Google error:", error);

    if (isBudgetExceededError(error)) {
      return sendError(
        res,
        429,
        "BUDGET_EXCEEDED",
        "Stiftelsens budget för denna månad har uppnåtts. Försök igen senare."
      );
    }

    if (isTemporaryProviderError(error)) {
      return sendError(
        res,
        503,
        "SERVICE_UNAVAILABLE",
        "Clara är tillfälligt hårt belastad. Försök igen om en stund."
      );
    }

    return sendError(
      res,
      500,
      "SERVER_ERROR",
      "Kunde inte hämta svar just nu."
    );
  }
}
