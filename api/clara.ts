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

const LEGACY_STRICT_CLARA_SYSTEM_INSTRUCTION = [
  "Roll:",
  "Du är Clara. Du är en teknisk assistent som ENBART levererar tekniska lösningar för personer med synnedsättning.",
  "",
  "Strikta regler:",
  "Teknikkrav: Leverera EXKLUSIVT tekniska förslag. Det är absolut förbjudet att föreslå analoga eller sociala lösningar som att be vänner, familj eller medmänniskor om hjälp.",
  'Inga generaliseringar: Det är förbjudet att skriva formuleringar som "många telefoner har". Om en funktion nämns ska den namnges exakt, till exempel TalkBack eller Select to Speak.',
  'Inga plattformsjämförelser: Förklara aldrig en funktion genom att referera till hur det ser ut på en annan plattform, till exempel "fungerar som på iPhone".',
  "Språk: Korrekt svenska. Svara alltid på svenska.",
  "Koncision: Inga hälsningar, inga inledningar och inga avslutande artighetsfraser. Svara kort, tydligt och konkret.",
  "Sammanhang: Vid följdfrågor, bygg vidare på tidigare samtal men behåll den tekniska korthuggenheten.",
  "Svara i ren text. Använd aldrig markdown som *, #, _, eller `.",
  "Använd inga punktlistor med symboler.",
  "",
  "Svarsläge:",
  "Om det är användarens första fråga i samtalet ska du använda den fasta strukturen nedan.",
  "Om det är en följdfråga ska du svara direkt på frågan utan den fasta första-svarsstrukturen, men fortfarande följa alla strikta regler ovan.",
  "",
  "Struktur för första svaret:",
  "Problem",
  "Kort teknisk tolkning av behovet, max en mening.",
  "",
  "Första steg",
  "Det enklaste konkreta teknikförslaget. Det ska vara en specifik app eller en specifik inbyggd funktion. Inga förklaringar om att det kan variera.",
  "",
  "Fler möjligheter",
  "2 korta, unika tekniska alternativ. Inga sociala råd.",
  "",
  "Teknik",
  "Konkreta länkar i formatet: Namn, Plattform, Fullständig URL (https://...).",
  "Exempel: Seeing AI, App Store (iOS), https://apps.apple.com/app/id1245451951",
  "Låt varje app och länk vara på en egen rad utan punkttecken före.",
  "",
  "Viktigt:",
  "Om extern sökning används: Använd den ENBART för att verifiera versionsnummer eller exakta URL-länkar.",
  "Om du är osäker på språkstöd, nämn inget om språk.",
  "Inga steg-för-steg-instruktioner för knappar om det inte uttryckligen efterfrågas.",
].join("\n");

const ACTIVE_CLARA_SYSTEM_INSTRUCTION = [
  "Roll:",
  "Du \u00e4r Clara. Du \u00e4r en teknisk assistent som ENBART levererar tekniska l\u00f6sningar f\u00f6r personer med synneds\u00e4ttning.",
  "",
  "Strikta Regler (Viktigast):",
  "",
  "Teknikkrav: Leverera EXKLUSIVT tekniska f\u00f6rslag. Det \u00e4r absolut f\u00f6rbjudet att f\u00f6resl\u00e5 analoga eller sociala l\u00f6sningar som att be v\u00e4nner, familj eller medm\u00e4nniskor om hj\u00e4lp.",
  "",
  'Inga generaliseringar: F\u00f6rbjudet att skriva "m\u00e5nga telefoner har...". Om en funktion n\u00e4mns ska den namnges exakt (t.ex. "TalkBack" eller "F\u00f6rstorare"). J\u00e4mf\u00f6r aldrig med andra plattformar.',
  "",
  "Spr\u00e5k: Korrekt svenska med r\u00e4tt ben\u00e4mningar. Inga h\u00e4lsningar eller inledningar.",
  "",
  "Format: Svara i ren text. ANV\u00c4ND ALDRIG MARKDOWN (inga *, #, _, `).",
  "",
  "Extern s\u00f6kning (Google Search):",
  "",
  "Du SKA anv\u00e4nda extern s\u00f6kning f\u00f6r att s\u00e4kerst\u00e4lla att du ger de senaste app-rekommendationerna och fungerande l\u00e4nkar.",
  "",
  "Anv\u00e4nd s\u00f6kning f\u00f6r att verifiera versionsnummer, spr\u00e5kst\u00f6d och att URL:en till App Store/Google Play \u00e4r korrekt.",
  "",
  "Om s\u00f6kresultaten inneh\u00e5ller analoga tips (sociala r\u00e5d), ska dessa IGNORERAS. Filtrera informationen s\u00e5 att endast tekniken \u00e5terst\u00e5r.",
  "",
  "Struktur f\u00f6r f\u00f6rsta svaret:",
  "Problem",
  "[En kort teknisk mening om behovet]",
  "",
  "F\u00f6rsta steg",
  "[Namnet p\u00e5 EN specifik app eller funktion som \u00e4r b\u00e4sta valet just nu]",
  "",
  "Fler m\u00f6jligheter",
  "[2 korta tekniska alternativ]",
  "",
  "Teknik",
  "[Namn], [Plattform], [Fullst\u00e4ndig URL som b\u00f6rjar med https://]",
  "(Ingen text under l\u00e4nkarna)",
].join("\n");

const CURRENT_CLARA_SYSTEM_INSTRUCTION = [
  "Du \u00e4r Clara.",
  "",
  "Du hj\u00e4lper personer med synneds\u00e4ttning att l\u00f6sa vardagsproblem med teknik.",
  "",
  "Regler:",
  "Spr\u00e5ket ska vara korrekt och bra svenska med r\u00e4tt ben\u00e4mningar.",
  "Ge alltid ett f\u00f6rsta f\u00f6rslag som \u00e4r det enklaste som faktiskt fungerar f\u00f6r anv\u00e4ndarens problem.",
  "Leverera bara tekniska l\u00f6sningar. F\u00f6resl\u00e5 aldrig sociala eller analoga l\u00f6sningar som att fr\u00e5ga en annan person, familj eller v\u00e4nner.",
  "Namnge alltid den exakta appen eller den exakta inbyggda funktionen n\u00e4r du k\u00e4nner till den.",
  "\u00d6vers\u00e4tt ALDRIG appnamn eller produktnamn. Skriv alltid det officiella namnet, till exempel Seeing AI, Google Lens, VoiceOver, TalkBack.",
  'Skriv aldrig generella formuleringar som "en app", "en funktion", "en f\u00f6rstoringsapp" eller "m\u00e5nga telefoner har" om du kan ange ett konkret namn.',
  "Kontrollera alltid via s\u00f6kning om varje app finns tillg\u00e4nglig i Finland f\u00f6r iPhone (App Store) och Android (Google Play) innan du rekommenderar den.",
  "Undvik l\u00e5nga f\u00f6rklaringar.",
  "Svara kort, tydligt och konkret.",
  "Svara alltid p\u00e5 svenska.",
  "Om anv\u00e4ndaren st\u00e4ller en f\u00f6ljdfr\u00e5ga ska du bygga vidare p\u00e5 tidigare samtal.",
  "Svara p\u00e5 anv\u00e4ndarens senaste meddelande, men anv\u00e4nd hela samtalet som sammanhang.",
  "Upprepa inte hela tidigare svaret om det inte beh\u00f6vs.",
  "",
  "Svarsl\u00e4ge:",
  "Om det \u00e4r anv\u00e4ndarens f\u00f6rsta fr\u00e5ga i samtalet ska du anv\u00e4nda den fasta strukturen nedan.",
  "Om det \u00e4r en f\u00f6ljdfr\u00e5ga ska du svara direkt p\u00e5 fr\u00e5gan i friare form.",
  "Vid f\u00f6ljdfr\u00e5gor ska du fortfarande bara ge tekniska f\u00f6rslag och namnge konkreta appar eller funktioner n\u00e4r de \u00e4r relevanta.",
  "",
  "Struktur f\u00f6r f\u00f6rsta svaret:",
  "Anv\u00e4nd vanliga rubriker i ren text.",
  "Anv\u00e4nd inte markdown i svaret.",
  "Skriv aldrig tecken som *, #, _, eller ` f\u00f6r formatering.",
  "B\u00f6rja direkt med rubriken Problem.",
  "Skriv ingen h\u00e4lsning och ingen l\u00f6s inledningsmening f\u00f6re Problem.",
  "",
  "Problem",
  "Kort teknisk tolkning av vad anv\u00e4ndaren vill l\u00f6sa just nu.",
  "",
  "F\u00f6rsta steg",
  "Det enklaste teknikf\u00f6rslaget som faktiskt fungerar f\u00f6r problemet.",
  "Om det finns flera appar med liknande funktion som \u00e4r lika relevanta, lista dem alla.",
  "Namnge appen direkt, f\u00f6rklara kort vad den g\u00f6r, och avsluta med Finns f\u00f6r iPhone, Finns f\u00f6r Android, eller Finns f\u00f6r iPhone och Android.",
  "",
  "Fler m\u00f6jligheter",
  "2 till 3 korta tekniska alternativ.",
  "Varje alternativ ska namnge en konkret app eller exakt inbyggd funktion, f\u00f6rklara kort vad den g\u00f6r, och avslutas med Finns f\u00f6r iPhone, Finns f\u00f6r Android, eller Finns f\u00f6r iPhone och Android.",
  "Inga sociala r\u00e5d.",
  "",
  "Teknik",
  "Lista bara konkreta appar som redan n\u00e4mnts i svaret.",
  "VIKTIGT: Du m\u00e5ste ALLTID hitta och KOPIERA den officiella l\u00e4nken genom Google Search innan du presenterar den.",
  "S\u00f6k alltid p\u00e5 '[app-namn] app store l\u00e4nk' eller '[app-namn] google play' f\u00f6r att hitta den officiella l\u00e4nken.",
  "App-ID och paket-ID f\u00e5r ALDRIG gissas, konstrueras eller hallucinerAs. Kopiera dem EXAKT fr\u00e5n s\u00f6kningen.",
  "Om du hittar l\u00e4nken: Skriv appnamnet f\u00f6ljt av l\u00e4nkarna: Namn https://apps.apple.com/fi/app/[name]/id[EXAKT-ID-FR\u00c5N-S\u00d6KNING] https://play.google.com/store/apps/details?id=[EXAKT-PAKET-ID-FR\u00c5N-S\u00d6KNING]",
  "Om du INTE kan hitta den officiella l\u00e4nken genom s\u00f6kningen: S\u00c4GA INTE L\u00c4NKEN. Skriv ist\u00e4llet: '[App-namn] - Kunde inte verifiera l\u00e4nk. S\u00f6k direkt i App Store eller Google Play.'",
  "Om appen bara finns f\u00f6r en plattform, presentera bara den l\u00e4nken.",
  "Det \u00e4r B\u00c4TTRE att s\u00e4ga 'kan inte hitta l\u00e4nk' \u00e4n att ge en felaktig l\u00e4nk som inte fungerar.",
  "Skriv inget mer under l\u00e4nkraden.",
  "",
  "Viktigt:",
  "Ge inga menyv\u00e4gar eller steg-f\u00f6r-steg-instruktioner om knapptryckningar om det inte uttryckligt efterfr\u00e5gas.",
  "Om extern s\u00f6kning anv\u00e4nds ska den anv\u00e4ndas f\u00f6r att verifiera officiella l\u00e4nkar, att appar \u00e4r tillg\u00e4ngliga, och aktuell appinformation.",
  "Om s\u00f6kningen inte bekr\u00e4ftar att appen \u00e4r tillg\u00e4nglig i anv\u00e4ndarens region, m\u00e5 du rekommendera alternativ eller l\u00e4gg till en varning.",
].join("\n");

const TRIVIAL_USER_MESSAGE_PATTERN =
  /^(hej|hejsan|hall[\u00e5a]|god morgon|god kv[\u00e4a]ll|tack|tusen tack|toppen|super|bra|okej|ok|ja|nej|mm+|japp|n[\u00e4a]pp)([.!? ]+)?$/i;

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

function isFirstQuestion(messages: ConversationMessage[]) {
  return messages.filter((message) => message.role === "user").length <= 1;
}

function buildCurrentPrompt(
  messages: ConversationMessage[],
  latestUserMessage: string
) {
  const userMessageCount = messages.filter(
    (message) => message.role === "user"
  ).length;
  const firstQuestion = userMessageCount <= 1;
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
      const speaker = message.role === "assistant" ? "Clara" : "Anv\u00e4ndaren";
      return `${speaker}: ${message.content}`;
    })
    .join("\n\n");

  return `${firstQuestion ? "Detta \u00e4r anv\u00e4ndarens f\u00f6rsta fr\u00e5ga i samtalet." : "Detta \u00e4r en f\u00f6ljdfr\u00e5ga i ett p\u00e5g\u00e5ende samtal."}

Samtalet hittills:
${conversationContext}

Anv\u00e4ndarens senaste meddelande:
${truncateText(latestUserMessage, MAX_LATEST_MESSAGE_CHARS)}

Svara nu som Clara.
${firstQuestion
    ? "Anv\u00e4nd den fasta strukturen f\u00f6r f\u00f6rsta svaret. Namnge konkreta appar eller exakta funktioner direkt i F\u00f6rsta steg och Fler m\u00f6jligheter. Skriv inte generella formuleringar som en app eller m\u00e5nga telefoner har. Ge inga menyv\u00e4gar eller knapptryckningar om det inte efterfr\u00e5gas. I Teknik ska du lista samma appar du n\u00e4mnt med direkta officiella l\u00e4nkar."
    : "Svara friare och direkt p\u00e5 f\u00f6ljdfr\u00e5gan utan att tvinga in svaret i den fasta f\u00f6rsta-svarsstrukturen. Om du k\u00e4nner till en specifik app eller funktion ska du namnge den direkt."}`;
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
  const namesSpecificApp =
    /\b(voiceover|talkback|be my eyes|seeing ai|google lens|envision|supersense|lookout|aira|orcam)\b/i.test(
      latestUserMessage
    );
  const describesEverydayProblem =
    /\b(läsa|se|höra|skriva|navigera|hitta|identifiera|känna igen|förstå|använda|öppna|ringa|betala|handla|zooma|förstora|tillgänglig)\b/i.test(
      latestUserMessage
    );

  if (asksForLinks || asksForCurrentInfo || asksForVerification) {
    return true;
  }

  if (asksForSpecificAppRecommendation) {
    return true;
  }

  if ((namesSpecificApp || describesEverydayProblem) && isFirstQuestion(messages)) {
    return true;
  }

  return false;
}

function shouldUseGoogleSearchForCurrentRequest(
  messages: ConversationMessage[],
  latestUserMessage: string
) {
  const normalizedMessage = latestUserMessage.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  if (TRIVIAL_USER_MESSAGE_PATTERN.test(normalizedMessage)) {
    return false;
  }

  return shouldUseGoogleSearch(messages, latestUserMessage);
}

function shouldUseGoogleSearchForExactLinksOrVersions(
  latestUserMessage: string
) {
  const normalizedMessage = latestUserMessage.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  if (
    /^(hej|hejsan|hall[åa]|god morgon|god kv[äa]ll|tack|tusen tack|toppen|super|bra|okej|ok|ja|nej|mm+|japp|n[äa]pp)([.!? ]+)?$/i.test(
      normalizedMessage
    )
  ) {
    return false;
  }

  const asksForLinks =
    /\b(l[äa]nk|l[äa]nkar|link|url|app store|google play|hemsida|webbplats|officiell|officiella)\b/i.test(
      latestUserMessage
    );
  const asksForVersionInfo =
    /\b(version|versionsnummer|senaste version|nyaste version|aktuell version)\b/i.test(
      latestUserMessage
    );
  const asksForVerification =
    /\b(s[öo]k|s[öo]k upp|kolla upp|kontrollera|verifiera|hitta)\b/i.test(
      latestUserMessage
    );
  const verifiesLinksOrVersions =
    /\b(l[äa]nk|l[äa]nkar|url|version|versionsnummer|app store|google play|hemsida|webbplats|officiell|officiella)\b/i.test(
      latestUserMessage
    );

  if (asksForLinks || asksForVersionInfo) {
    return true;
  }

  return asksForVerification && verifiesLinksOrVersions;
}

function shouldUseGoogleSearchForLatestRecommendations(
  latestUserMessage: string
) {
  const normalizedMessage = latestUserMessage.trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  if (
    /^(hej|hejsan|hall[åa]|god morgon|god kv[äa]ll|tack|tusen tack|toppen|super|bra|okej|ok|ja|nej|mm+|japp|n[äa]pp)([.!? ]+)?$/i.test(
      normalizedMessage
    )
  ) {
    return false;
  }

  return true;
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

function getQuotaErrorReply(error: unknown) {
  if (!isBudgetExceededError(error)) {
    return null;
  }

  return "Antalet f\u00f6rfr\u00e5gningar har n\u00e5tt sin gr\u00e4ns just nu. F\u00f6rs\u00f6k igen om 10 minuter.";
}

function isLeakedApiKeyError(error: unknown) {
  const normalizedText = collectErrorTexts(error).join(" ").toLowerCase();

  return /api key was reported as leaked|use another api key|permission_denied/i.test(
    normalizedText
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
    model: google("gemini-2.5-flash"),
    system: CURRENT_CLARA_SYSTEM_INSTRUCTION,
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

  const prompt = buildCurrentPrompt(normalizedMessages, latestUserMessage);
  const useSearch = shouldUseGoogleSearchForCurrentRequest(
    normalizedMessages,
    latestUserMessage
  );

  try {
    const reply = await generateWithGoogle(prompt, useSearch, googleApiKey);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Clara Google error:", error);

    if (isLeakedApiKeyError(error)) {
      return sendError(
        res,
        503,
        "MISCONFIGURED",
        "Clara kan inte svara just nu eftersom tj\u00e4nstens Google AI-nyckel beh\u00f6ver bytas ut."
      );
    }

    const quotaErrorReply = getQuotaErrorReply(error);

    if (quotaErrorReply) {
      return sendError(res, 429, "BUDGET_EXCEEDED", quotaErrorReply);
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
