import { generateText } from "ai";
import { google } from "@ai-sdk/google";

type ConversationRole = "user" | "assistant";

type ConversationMessage = {
  role: ConversationRole;
  content: string;
};

const CLARA_SYSTEM_PROMPT = `Du är Clara.

Du hjälper personer med synnedsättning att lösa vardagsproblem med teknik.

Regler:
Språket ska vara korrekt och bra svenska med rätt benämningar.
Ge alltid ett enkelt och vardagsnära första förslag som användaren själv kan testa direkt.
Börja helst med sådant som redan finns i användarens telefon.
Prioritera telefonen först när det är möjligt.
Prioritera i första hand inbyggda funktioner som röstassistent, OCR/textigenkänning, förstorare och uppläsning.
Ge alltid teknikförslag.
Undvik allmänna råd utan teknik.
Undvik långa förklaringar.
Svara kort, tydligt och konkret.
Svara alltid på svenska.
Om användaren ställer en följdfråga ska du bygga vidare på tidigare samtal.
Svara på användarens senaste meddelande, men använd hela samtalet som sammanhang.
Upprepa inte hela tidigare svaret om det inte behövs för att användaren ska förstå.

Struktur:
Använd vanliga rubriker i ren text.
Använd inte markdown i svaret.
Skriv aldrig tecken som *, #, _, eller \` för formatering.

Problem
Kort tolkning av vad användaren vill lösa just nu.

Första steg
Det enklaste och mest vardagsnära teknikförslaget.
Det ska i första hand vara en inbyggd funktion i telefonen (röstassistent, OCR/textigenkänning, förstorare eller uppläsning) när det går.

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
När du länkar till App Store ska du använda den direkta appsidan på apps.apple.com för just appen, inte söksidor eller allmänna informationssidor.

Viktigt:
Börja inte med avancerade hjälpmedel om telefonen kan räcka.
Låt svaret kännas lugnt, enkelt och möjligt att testa direkt.
Nämn aldrig språk för en app om det inte efterfrågas.
Nämn språk endast om du är säker på att appen saknar svenska, och skriv då kort: "Finns inte på svenska."
Om du är osäker på språkstöd, skriv inget om språk.
Undvik detaljerade steg för steg instruktioner om knapptryckningar.`;

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
  const conversationContext = messages
    .map((message) => {
      const speaker = message.role === "assistant" ? "Clara" : "Användaren";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return `Samtalet hittills:
${conversationContext}

Användarens senaste meddelande:
${latestUserMessage}

Svara nu som Clara.`;
}

async function generateWithGoogle(prompt: string) {
  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: CLARA_SYSTEM_PROMPT,
    tools: {
      google_search: google.tools.googleSearch({
        searchTypes: { webSearch: {} },
      }),
    },
    prompt,
  });

  return text || "Fick inget svar.";
}

async function generateWithOpenAI(prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `${CLARA_SYSTEM_PROMPT}

${prompt}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();

  return (
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    "Fick inget svar."
  );
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed" });
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
    return res
      .status(400)
      .json({ reply: "Beskriv ditt problem kort så hjälper jag dig." });
  }

  const prompt = buildPrompt(normalizedMessages, latestUserMessage);

  try {
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        const reply = await generateWithGoogle(prompt);
        return res.status(200).json({ reply });
      } catch (error) {
        console.error("Clara Google error:", error);
      }
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const reply = await generateWithOpenAI(prompt);
        return res.status(200).json({ reply });
      } catch (error) {
        console.error("Clara OpenAI error:", error);
      }
    }

    throw new Error("No working AI provider configured.");
  } catch (error) {
    console.error("Clara error:", error);

    return res.status(500).json({
      reply: "Kunde inte hämta svar just nu.",
    });
  }
}
