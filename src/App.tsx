import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import claraLogoDark from "./assets/clara-logo-dark.png";
import claraLogoLight from "./assets/clara-logo-light.png";

const EXAMPLES = [
  "Jag kan inte läsa min post",
  "Jag vet inte vilken burk jag håller i",
  "Jag ser inte om golvet är smutsigt",
];

const INITIAL_REPLY = "Beskriv ditt problem så hjälper jag dig.";
const THINKING_REPLY = "Clara tänker...";
const CLARA_VIOLET = "#34225C";
const CLARA_LIGHT_VIOLET = "#C9C4D4";
const CLARA_YELLOW = "#FEB93C";
const CLARA_BLACK = "#000000";
const CLARA_WHITE = "#FFFFFF";

type ThemeMode = "light" | "dark";
type ConversationRole = "user" | "assistant";

type ApiConversationMessage = {
  role: ConversationRole;
  content: string;
};

type ApiErrorResponse = {
  code?: string;
  reply?: string;
};

type ConversationMessage = ApiConversationMessage & {
  id: string;
};

type ActionFeedbackState = {
  messageId: string | null;
  text: string;
};

type AnnouncementState = {
  key: number;
  text: string;
};

async function postClaraRequest(body: {
  problem: string;
  messages?: ApiConversationMessage[];
}) {
  return fetch("/api/clara", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function readApiErrorResponse(
  response: Response
): Promise<ApiErrorResponse | null> {
  try {
    const errorData = (await response.json()) as ApiErrorResponse;
    if (
      typeof errorData?.reply === "string" &&
      errorData.reply.trim() !== ""
    ) {
      return errorData;
    }
  } catch {
    // ignore JSON parse errors for non-JSON responses
  }

  return null;
}

async function getClaraReplyFromAPI(
  messages: ApiConversationMessage[]
): Promise<string> {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim();

  if (!latestUserMessage) {
    return "Beskriv ditt problem kort så hjälper jag dig.";
  }

  try {
    const response = await postClaraRequest({
      problem: latestUserMessage,
      messages,
    });

    if (response.status === 404) {
      return "API hittades inte. Kör appen med Vercel lokalt (vercel dev) eller publicera till Vercel.";
    }

    if (!response.ok) {
      const errorData = await readApiErrorResponse(response);

      if (typeof errorData?.reply === "string" && errorData.reply.trim() !== "") {
        return errorData.reply;
      }

      if (response.status === 429) {
        return "För många förfrågningar just nu. Vänta en stund och försök igen.";
      }

      if (response.status === 503) {
        return "Clara är tillfälligt hårt belastad. Försök igen om en stund.";
      }

      return "Kunde inte hämta svar just nu. Försök igen om en stund.";
    }

    const data = (await response.json()) as ApiErrorResponse;
    return typeof data.reply === "string" && data.reply.trim() !== ""
      ? data.reply
      : "Fick inget svar. Testa igen.";
  } catch {
    return "Kunde inte nå tjänsten just nu.";
  }
}

function createMessage(
  role: ConversationRole,
  content: string
): ConversationMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function getBestSwedishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();

  if (!voices.length) {
    return null;
  }

  return (
    voices.find((voice) => voice.lang === "sv-FI") ||
    voices.find((voice) => voice.lang === "sv-SE") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("sv")) ||
    null
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFontScale(step: number) {
  return 1 + step * 0.12;
}

function formatReply(
  reply: string,
  styles: Record<string, CSSProperties>
) {
  function isAppStoreUrl(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "apps.apple.com";
    } catch {
      return false;
    }
  }

  function getLinkHref(url: string) {
    if (!isAppStoreUrl(url)) {
      return url;
    }

    try {
      const parsed = new URL(url);
      return `itms-apps://${parsed.host}${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }

  function getLinkTarget(url: string) {
    return isAppStoreUrl(url) ? "_self" : "_blank";
  }

  function isUrlOnlyLine(value: string) {
    return /^https?:\/\/\S+$/i.test(value.trim());
  }

  function isStandaloneListHeading(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.endsWith(":") && trimmedValue.length <= 24;
  }

  function isContinuationBullet(value: string) {
    return /^(App Store|Google Play|Läs mer|Mer info|Hemsida|Webbplats|Officiell länk|Länk)\b/i.test(
      value.trim()
    );
  }

  function getLinkLabel(url: string) {
    const lower = url.toLowerCase();
    if (lower.includes("apps.apple.com")) return "App Store (iOS)";
    if (lower.includes("play.google.com")) return "Google Play (Android)";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
    if (lower.includes("support.apple.com")) return "Apple Support";
    if (lower.includes("support.google.com")) return "Google Support";

    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return "Länk";
    }
  }

  function renderTextWithLinks(value: string): ReactNode[] {
    const urlRegex = /(https?:\/\/[^\s)]+[^\s.,;!?)]?)/g;
    const parts = value.split(urlRegex);

    return parts.map((part, index) => {
      const isUrl = /^https?:\/\//.test(part);
      if (!isUrl) {
        return part;
      }

      return (
        <a
          key={`${part}-${index}`}
          href={getLinkHref(part)}
          target={getLinkTarget(part)}
          rel="noreferrer noopener"
          style={styles.replyLink}
          aria-label={`Öppna länk: ${getLinkLabel(part)}`}
        >
          {getLinkLabel(part)}
        </a>
      );
    });
  }

  function renderLineContent(value: string): ReactNode {
    if (/^https?:\/\//i.test(value.trim())) {
      return <>{renderTextWithLinks(value)}</>;
    }

    const subHeadingMatch = value.match(/^([^:]{2,40}):\s*(.+)$/);
    if (subHeadingMatch) {
      const label = subHeadingMatch[1].trim();
      const rest = subHeadingMatch[2].trim();
      return (
        <>
          <strong>{label}:</strong>{" "}
          {rest ? renderTextWithLinks(rest) : null}
        </>
      );
    }

    return <>{renderTextWithLinks(value)}</>;
  }

  function sanitizeInlineMarkdown(value: string) {
    return value
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/^\s*#{1,6}\s*/g, "")
      .replace(/^\s*[*#]+\s*/g, "")
      .replace(/\*/g, "")
      .trim();
  }

  const headingLines = [
    "Problem",
    "Första steg",
    "Fler möjligheter",
    "Teknik",
    "Det här kan hjälpa dig",
    "Enkelt att börja med",
    "Bra att veta",
  ];

  const lines = reply.split("\n").map((line) => line.trim()).filter(Boolean);
  const blocks: Array<
    | { type: "heading"; value: string }
    | { type: "subheading"; value: string }
    | { type: "paragraph"; value: string }
    | { type: "list"; items: string[]; ordered: boolean }
  > = [];
  let previousLineWasListItem = false;
  const subheadingLines = [
    "iphone",
    "android",
    "appar",
    "ios",
    "inbyggt i iphone",
    "inbyggt i android",
  ];

  function normalizeHeadingCandidate(value: string) {
    return sanitizeInlineMarkdown(
      value
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\*\*(.+)\*\*$/, "$1")
        .replace(/^__(.+)__$/, "$1")
        .replace(/:$/, "")
        .trim()
    );
  }

  function isShortStandaloneSubheading(value: string) {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    return (
      subheadingLines.includes(normalizedValue) ||
      (/^[A-ZÅÄÖ][A-Za-zÅÄÖåäö0-9 /()-]{1,28}$/.test(trimmedValue) &&
        trimmedValue.split(/\s+/).length <= 4 &&
        !trimmedValue.includes(":") &&
        !trimmedValue.includes("."))
    );
  }

  function pushListItem(item: string, ordered: boolean) {
    const previousBlock = blocks[blocks.length - 1];
    if (
      previousBlock &&
      previousBlock.type === "list" &&
      previousBlock.ordered === ordered
    ) {
      previousBlock.items.push(item);
      return;
    }

    blocks.push({ type: "list", items: [item], ordered });
  }

  function appendToPreviousBlock(value: string) {
    const previousBlock = blocks[blocks.length - 1];

    if (!previousBlock) {
      return false;
    }

    if (previousBlock.type === "list" && previousBlock.items.length > 0) {
      const lastItemIndex = previousBlock.items.length - 1;
      previousBlock.items[lastItemIndex] =
        `${previousBlock.items[lastItemIndex]} ${value}`.trim();
      return true;
    }

    if (previousBlock.type === "paragraph") {
      previousBlock.value = `${previousBlock.value} ${value}`.trim();
      return true;
    }

    return false;
  }

  for (const line of lines) {
    const cleanedLine = normalizeHeadingCandidate(line);
    const normalized = cleanedLine.toLowerCase();
    const isHeading = headingLines.some(
      (heading) => normalized === heading.toLowerCase()
    );
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
    const markdownHeadingMatch = line.match(/^#{1,6}\s+(.+)$/);
    const strongOnlyMatch = line.match(/^\*\*(.+)\*\*$/);

    if (isHeading || markdownHeadingMatch || strongOnlyMatch) {
      blocks.push({ type: "heading", value: cleanedLine });
      previousLineWasListItem = false;
      continue;
    }

    if (isShortStandaloneSubheading(cleanedLine)) {
      blocks.push({ type: "subheading", value: cleanedLine });
      previousLineWasListItem = false;
      continue;
    }

    if (bulletMatch) {
      const bulletValue = sanitizeInlineMarkdown(bulletMatch[1]);

      if (isStandaloneListHeading(bulletValue)) {
        blocks.push({
          type: "subheading",
          value: bulletValue.replace(/:$/, "").trim(),
        });
        previousLineWasListItem = false;
        continue;
      }

      if (
        (isUrlOnlyLine(bulletValue) || isContinuationBullet(bulletValue)) &&
        appendToPreviousBlock(bulletValue)
      ) {
        previousLineWasListItem = true;
        continue;
      }

      pushListItem(bulletValue, false);
      previousLineWasListItem = true;
      continue;
    }

    if (numberedMatch) {
      const numberedValue = sanitizeInlineMarkdown(numberedMatch[1]);

      if (isStandaloneListHeading(numberedValue)) {
        blocks.push({
          type: "subheading",
          value: numberedValue.replace(/:$/, "").trim(),
        });
        previousLineWasListItem = false;
        continue;
      }

      if (
        (isUrlOnlyLine(numberedValue) || isContinuationBullet(numberedValue)) &&
        appendToPreviousBlock(numberedValue)
      ) {
        previousLineWasListItem = true;
        continue;
      }

      pushListItem(numberedValue, true);
      previousLineWasListItem = true;
      continue;
    }

    const sanitizedLine = sanitizeInlineMarkdown(line);

    if (isUrlOnlyLine(sanitizedLine) && appendToPreviousBlock(sanitizedLine)) {
      previousLineWasListItem = false;
      continue;
    }

    const previousBlock = blocks[blocks.length - 1];

    if (
      previousLineWasListItem &&
      previousBlock &&
      previousBlock.type === "list" &&
      previousBlock.items.length > 0
    ) {
      const lastItemIndex = previousBlock.items.length - 1;
      previousBlock.items[lastItemIndex] =
        `${previousBlock.items[lastItemIndex]} ${sanitizedLine}`.trim();
      continue;
    }

    blocks.push({ type: "paragraph", value: sanitizedLine });
    previousLineWasListItem = false;
  }

  const firstHeadingIndex = blocks.findIndex((block) => block.type === "heading");
  if (firstHeadingIndex > 0) {
    while (blocks[0] && blocks[0].type === "paragraph") {
      blocks.shift();
    }
  }

  return blocks.map((block, index) => {
    if (block.type === "heading") {
      return (
        <h3 key={index} style={styles.replyHeading}>
          {block.value}
        </h3>
      );
    }

    if (block.type === "subheading") {
      return (
        <h4 key={index} style={styles.replySubheading}>
          {block.value}
        </h4>
      );
    }

    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag key={index} style={styles.replyList}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`} style={styles.replyListItem}>
              {renderLineContent(item)}
            </li>
          ))}
        </ListTag>
      );
    }

    return (
      <p key={index} style={styles.replyParagraph}>
        {renderLineContent(block.value)}
      </p>
    );
  });
}

function MenuIcon({
  size = 22,
  color = CLARA_VIOLET,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7H20M4 12H20M4 17H20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon({
  size = 20,
  color = CLARA_VIOLET,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" fill={color} />
      <path
        d="M12 1.8V4.2M12 19.8V22.2M4.2 12H1.8M22.2 12H19.8M5.1 5.1L6.8 6.8M17.2 17.2L18.9 18.9M18.9 5.1L17.2 6.8M6.8 17.2L5.1 18.9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({
  size = 20,
  color = CLARA_VIOLET,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 14.2C19.2 14.5 18.4 14.6 17.5 14.6C13.4 14.6 10.1 11.3 10.1 7.2C10.1 5.8 10.5 4.5 11.2 3.4C6.8 3.9 3.4 7.7 3.4 12.2C3.4 17.1 7.3 21 12.2 21C16.7 21 20.5 17.6 21 13.2C20.7 13.6 20.4 13.9 20 14.2Z"
        fill={color}
      />
    </svg>
  );
}

function ThemePreviewIcon({
  mode,
  size = 20,
  color = CLARA_VIOLET,
}: {
  mode: ThemeMode;
  size?: number;
  color?: string;
}) {
  if (mode === "dark") {
    return <MoonIcon size={size} color={color} />;
  }

  return <SunIcon size={size} color={color} />;
}

function getThemeLabel(mode: ThemeMode) {
  if (mode === "dark") return "Mörkt läge";
  return "Ljust läge";
}

function getThemeLogo(mode: ThemeMode) {
  return mode === "dark" ? claraLogoDark : claraLogoLight;
}

function createStyles(
  activeTheme: ThemeMode,
  textSizeStep: number
): Record<string, CSSProperties> {
  const scale = getFontScale(textSizeStep);
  const isDark = activeTheme === "dark";

  const pageBackground = isDark ? CLARA_BLACK : CLARA_WHITE;
  const panelBackground = isDark ? "#0F0F0F" : "#F7F5FA";
  const fieldBackground = isDark ? "#050505" : CLARA_WHITE;
  const menuBackground = isDark ? "#101010" : CLARA_WHITE;
  const borderColor = isDark
    ? "1px solid rgba(255, 255, 255, 0.18)"
    : `1px solid ${CLARA_LIGHT_VIOLET}`;
  const subtleBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.12)"
    : "1px solid rgba(52, 34, 92, 0.10)";
  const mainText = isDark ? CLARA_WHITE : CLARA_BLACK;
  const mutedText = isDark ? "rgba(255, 255, 255, 0.78)" : "rgba(52, 34, 92, 0.84)";
  const softText = isDark ? "rgba(255, 255, 255, 0.70)" : "rgba(0, 0, 0, 0.72)";
  const headingColor = isDark ? CLARA_WHITE : CLARA_VIOLET;
  const accentColor = isDark ? CLARA_YELLOW : CLARA_VIOLET;
  const actionSurface = isDark ? "rgba(255, 255, 255, 0.04)" : CLARA_WHITE;
  const chipSurface = isDark ? "rgba(255, 255, 255, 0.03)" : "#F6F2FB";
  const userBubbleBackground = isDark ? CLARA_VIOLET : CLARA_LIGHT_VIOLET;
  const userBubbleText = isDark ? CLARA_WHITE : CLARA_BLACK;
  const buttonShadow = isDark
    ? "none"
    : "0 18px 30px rgba(52, 34, 92, 0.08)";

  return {
    page: {
      minHeight: "100vh",
      background: pageBackground,
      color: mainText,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "32px 16px 56px",
      fontFamily: '"Atkinson Hyperlegible", system-ui, sans-serif',
    },
    container: {
      width: "100%",
      maxWidth: 760,
      background: pageBackground,
      padding: 0,
      textAlign: "center",
      position: "relative",
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "48px minmax(0, 1fr) 48px",
      alignItems: "start",
      marginBottom: 28,
      columnGap: 12,
    },
    topSpacer: {
      width: 48,
      height: 48,
    },
    centerLogo: {
      justifySelf: "center",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 4,
    },
    logo: {
      width: "100%",
      maxWidth: 240,
      display: "block",
    },
    menuWrap: {
      justifySelf: "end",
      position: "relative",
    },
    menuButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      border: borderColor,
      background: actionSurface,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    },
    menuPanel: {
      position: "absolute",
      top: 56,
      right: 0,
      width: 248,
      background: menuBackground,
      border: borderColor,
      borderRadius: 20,
      boxShadow: buttonShadow,
      padding: 16,
      zIndex: 20,
      textAlign: "left",
    },
    panelGroup: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    panelLabel: {
      fontSize: 13 * scale,
      fontWeight: 700,
      color: headingColor,
      letterSpacing: "0.02em",
    },
    panelDivider: {
      height: 1,
      background: isDark
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(52, 34, 92, 0.12)",
      margin: "4px 0",
      border: "none",
    },
    themeOptions: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
    },
    themeOption: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      width: "100%",
      padding: "12px 10px",
      borderRadius: 14,
      border: borderColor,
      background: actionSurface,
      color: mainText,
      cursor: "pointer",
      textAlign: "center",
      fontSize: 14 * scale,
      fontWeight: 700,
    },
    themeOptionActive: {
      border: `2px solid ${accentColor}`,
    },
    textRow: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    sizeButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      border: borderColor,
      background: actionSurface,
      color: mainText,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontWeight: 700,
      lineHeight: 1,
      padding: 0,
    },
    smallT: {
      fontSize: `${clamp(12 + textSizeStep * 2, 10, 24)}px`,
    },
    largeT: {
      fontSize: `${clamp(20 + textSizeStep * 3, 14, 40)}px`,
    },
    intro: {
      maxWidth: 32 * 16,
      fontSize: 18 * scale,
      lineHeight: 1.6,
      color: mutedText,
      margin: "0 auto 28px",
      letterSpacing: "0.01em",
    },
    label: {
      display: "block",
      fontSize: 15 * scale,
      fontWeight: 700,
      marginBottom: 12,
      color: headingColor,
      textAlign: "left",
      letterSpacing: "0.01em",
    },
    textarea: {
      width: "100%",
      minHeight: 132,
      padding: 18,
      borderRadius: 20,
      border: borderColor,
      fontSize: 17 * scale,
      lineHeight: 1.6,
      boxSizing: "border-box",
      resize: "vertical",
      marginBottom: 16,
      background: fieldBackground,
      color: mainText,
      fontFamily: "inherit",
      letterSpacing: "0.01em",
    },
    primaryButton: {
      width: "100%",
      padding: "15px 18px",
      borderRadius: 18,
      border: `1px solid ${CLARA_VIOLET}`,
      background: CLARA_VIOLET,
      color: CLARA_WHITE,
      fontSize: 16 * scale,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: buttonShadow,
      letterSpacing: "0.01em",
    },
    primaryButtonDisabled: {
      opacity: 0.6,
      cursor: "not-allowed",
    },
    examplesWrap: {
      marginTop: 24,
    },
    examplesTitle: {
      fontSize: 14 * scale,
      fontWeight: 700,
      color: headingColor,
      marginBottom: 12,
      letterSpacing: "0.02em",
    },
    chips: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "center",
    },
    chip: {
      padding: "10px 14px",
      borderRadius: 999,
      border: subtleBorder,
      background: chipSurface,
      color: mainText,
      cursor: "pointer",
      fontSize: 14 * scale,
      lineHeight: 1.45,
    },
    answerBox: {
      marginTop: 24,
      background: panelBackground,
      borderRadius: 24,
      padding: 22,
      textAlign: "left",
      border: subtleBorder,
    },
    answerTitle: {
      margin: "0 0 8px 0",
      fontSize: 13 * scale,
      fontWeight: 700,
      color: softText,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    },
    actionsWrap: {
      marginTop: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    secondaryButton: {
      width: "100%",
      padding: "13px 16px",
      borderRadius: 18,
      border: borderColor,
      background: actionSurface,
      color: mainText,
      fontSize: 15 * scale,
      fontWeight: 700,
      cursor: "pointer",
      letterSpacing: "0.01em",
    },
    replyHeading: {
      margin: "20px 0 8px 0",
      fontSize: 20 * scale,
      fontWeight: 700,
      color: headingColor,
      lineHeight: 1.35,
      letterSpacing: "0.01em",
    },
    replySubheading: {
      margin: "16px 0 6px 0",
      fontSize: 17 * scale,
      fontWeight: 700,
      color: accentColor,
      lineHeight: 1.4,
      letterSpacing: "0.01em",
    },
    replyParagraph: {
      margin: "0 0 14px 0",
      lineHeight: 1.7,
      color: mainText,
      fontSize: 16 * scale,
      letterSpacing: "0.01em",
    },
    replyList: {
      margin: "0 0 14px 0",
      paddingLeft: 24,
      color: mainText,
      fontSize: 16 * scale,
      lineHeight: 1.7,
      letterSpacing: "0.01em",
    },
    replyListItem: {
      marginBottom: 8,
    },
    replyLink: {
      color: accentColor,
      textDecoration: "underline",
      textUnderlineOffset: 3,
      wordBreak: "break-word",
    },
    conversationList: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      marginTop: 12,
      textAlign: "left",
    },
    userBubble: {
      alignSelf: "flex-end",
      maxWidth: "88%",
      padding: "16px 18px",
      borderRadius: 22,
      border: "none",
      background: userBubbleBackground,
      color: userBubbleText,
      fontSize: 16 * scale,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      letterSpacing: "0.01em",
    },
    thinkingText: {
      margin: 0,
      color: softText,
      fontSize: 16 * scale,
      lineHeight: 1.6,
    },
    conversationForm: {
      marginTop: 24,
      paddingTop: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      borderTop: subtleBorder,
    },
    conversationTextarea: {
      width: "100%",
      minHeight: 104,
      padding: 18,
      borderRadius: 20,
      border: borderColor,
      fontSize: 16 * scale,
      lineHeight: 1.6,
      boxSizing: "border-box",
      resize: "vertical",
      background: fieldBackground,
      color: mainText,
      fontFamily: "inherit",
      letterSpacing: "0.01em",
    },
    conversationActions: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    messageActions: {
      marginTop: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    messageFeedback: {
      margin: "2px 0 0 0",
      fontSize: 13 * scale,
      lineHeight: 1.5,
      color: softText,
    },
    srOnly: {
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: 0,
    },
  };
}

export default function App() {
  const [problem, setProblem] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [textSizeStep, setTextSizeStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<AnnouncementState>({
    key: 0,
    text: "",
  });
  const [actionFeedback, setActionFeedback] = useState<ActionFeedbackState>({
    messageId: null,
    text: "",
  });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedTheme = window.localStorage.getItem("clara-theme-mode");
      const savedTextSize = window.localStorage.getItem("clara-text-size");

      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeMode(savedTheme);
      }

      if (savedTextSize !== null) {
        const parsed = Number(savedTextSize);
        if (!Number.isNaN(parsed)) {
          setTextSizeStep(clamp(parsed, -4, 10));
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("clara-theme-mode", themeMode);
    } catch {
      // ignore localStorage errors
    }
  }, [themeMode]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("clara-text-size", String(textSizeStep));
    } catch {
      // ignore localStorage errors
    }
  }, [textSizeStep]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!messages.length && !loading) {
      return;
    }

    conversationEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? "smooth" : "auto",
      block: "end",
    });
  }, [messages, loading]);

  const styles = useMemo(
    () => createStyles(themeMode, textSizeStep),
    [themeMode, textSizeStep]
  );
  const themeIconColor = themeMode === "dark" ? CLARA_WHITE : CLARA_VIOLET;
  const currentLogo = getThemeLogo(themeMode);

  const hasConversation = messages.length > 0;
  const canSubmit = !loading && problem.trim() !== "";
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  function stopSpeaking() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
  }

  async function runQuery(input: string) {
    const trimmedInput = input.trim();

    if (!trimmedInput || loading) {
      return;
    }

    stopSpeaking();
    setActionFeedback({ messageId: null, text: "" });
    setMenuOpen(false);

    const userMessage = createMessage("user", trimmedInput);
    const nextMessages = [...messages, userMessage];
    const apiMessages = nextMessages.map(({ role, content }) => ({ role, content }));

    setProblem("");
    setMessages(nextMessages);
    setLoading(true);

    try {
      const result = await getClaraReplyFromAPI(apiMessages);
      const assistantMessage = createMessage("assistant", result);

      setMessages((prev) => [...prev, assistantMessage]);
      setAnnouncement((prev) => ({
        key: prev.key + 1,
        text: result,
      }));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    await runQuery(problem);
  }

  async function handleExampleClick(example: string) {
    await runQuery(example);
  }

  function handleResetConversation() {
    stopSpeaking();
    setMessages([]);
    setProblem("");
    setLoading(false);
    setAnnouncement((prev) => ({
      key: prev.key + 1,
      text: "Samtalet började om.",
    }));
    setActionFeedback({ messageId: null, text: "" });
  }

  function handleToggleSpeech(message: ConversationMessage) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;

    if (speakingMessageId === message.id) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message.content);
    const bestVoice = getBestSwedishVoice();

    utterance.lang = "sv-SE";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang;
    }

    utterance.onend = () => {
      setSpeakingMessageId((current) => (current === message.id ? null : current));
    };

    utterance.onerror = () => {
      setSpeakingMessageId((current) => (current === message.id ? null : current));
    };

    synth.cancel();
    synth.speak(utterance);
    setSpeakingMessageId(message.id);
  }

  function increaseTextSize() {
    setTextSizeStep((prev) => clamp(prev + 1, -4, 10));
  }

  function decreaseTextSize() {
    setTextSizeStep((prev) => clamp(prev - 1, -4, 10));
  }

  function getTextSizeDescription() {
    return `Textstorlek nivå ${textSizeStep + 5} av 15.`;
  }

  function getThemeOptionAriaLabel(mode: ThemeMode) {
    return `${getThemeLabel(mode)}. ${
      themeMode === mode ? "Valt läge." : "Välj detta läge."
    }`;
  }

  function buildConversationExportText() {
    if (!messages.length) {
      return "Samtalet är tomt.";
    }

    return messages
      .map((message) => {
        const label = message.role === "user" ? "Du" : "Clara";
        return `${label}\n${message.content}`;
      })
      .join("\n\n");
  }

  function saveReplyToFile(content: string) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Kan inte spara fil i den här miljön.");
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const file = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = `clara-samtal-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async function handleShareOrSave() {
    const exportText = buildConversationExportText();
    const feedbackMessageId = latestAssistantMessage?.id ?? null;

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "Samtal från Clara",
          text: exportText,
        });
        setActionFeedback({
          messageId: feedbackMessageId,
          text: "Delningsmenyn öppnades.",
        });
        return;
      }

      saveReplyToFile(exportText);
      setActionFeedback({
        messageId: feedbackMessageId,
        text: "Samtalet sparades som en textfil.",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"
        ) {
          await navigator.clipboard.writeText(exportText);
          setActionFeedback({
            messageId: feedbackMessageId,
            text: "Samtalet kopierades till urklipp.",
          });
          return;
        }
      } catch {
        // ignore clipboard fallback errors
      }

      setActionFeedback({
        messageId: feedbackMessageId,
        text: "Det gick inte att dela eller spara samtalet just nu.",
      });
    }
  }

  return (
    <main style={styles.page} aria-label="Clara hjälpmedelsassistent">
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.topSpacer} />

          <div style={styles.centerLogo}>
            <img src={currentLogo} alt="Clara" style={styles.logo} />
          </div>

          <div style={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              style={styles.menuButton}
              aria-label={
                menuOpen ? "Stäng inställningsmenyn" : "Öppna inställningsmenyn"
              }
              aria-expanded={menuOpen}
              title="Inställningar"
            >
              <MenuIcon size={22} color={themeIconColor} />
            </button>

            {menuOpen && (
              <div style={styles.menuPanel} role="menu" aria-label="Inställningar">
                <div style={styles.panelGroup}>
                  <div style={styles.panelLabel}>Textstorlek</div>

                  <div style={styles.textRow}>
                    <button
                      type="button"
                      onClick={decreaseTextSize}
                      style={styles.sizeButton}
                      aria-label={`Minska textstorleken. ${getTextSizeDescription()}`}
                      title="Minska textstorleken"
                    >
                      <span style={styles.smallT}>T</span>
                    </button>

                    <button
                      type="button"
                      onClick={increaseTextSize}
                      style={styles.sizeButton}
                      aria-label={`Öka textstorleken. ${getTextSizeDescription()}`}
                      title="Öka textstorleken"
                    >
                      <span style={styles.largeT}>T</span>
                    </button>
                  </div>

                  <hr style={styles.panelDivider} />

                  <div style={styles.panelLabel}>Tema</div>

                  <div style={styles.themeOptions}>
                    {(["light", "dark"] as ThemeMode[]).map(
                      (mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setThemeMode(mode)}
                          style={{
                            ...styles.themeOption,
                            ...(themeMode === mode ? styles.themeOptionActive : {}),
                          }}
                          aria-label={getThemeOptionAriaLabel(mode)}
                          title={getThemeLabel(mode)}
                        >
                          <ThemePreviewIcon
                            mode={mode}
                            size={20}
                            color={
                              themeMode === "dark" && themeMode === mode
                                ? CLARA_YELLOW
                                : themeIconColor
                            }
                          />
                          <span>{getThemeLabel(mode)}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={styles.intro}>
          Beskriv ett synrelaterat problem i vardagen så får du förslag på teknik som kan hjälpa.
        </p>

        {!hasConversation ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              aria-label="Formulär för att beskriva problem"
            >
              <label htmlFor="clara-problem" style={styles.label}>
                Beskriv ditt problem
              </label>

              <textarea
                id="clara-problem"
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="Till exempel: Jag kan inte läsa min post"
                style={styles.textarea}
                aria-label="Beskriv ditt problem"
              />

              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  ...styles.primaryButton,
                  ...(!canSubmit ? styles.primaryButtonDisabled : {}),
                }}
                aria-label={loading ? "Clara tänker" : "Få hjälp"}
                title="Få hjälp"
              >
                {loading ? "Clara tänker..." : "Få hjälp"}
              </button>
            </form>

            <div style={styles.examplesWrap}>
              <div style={styles.examplesTitle}>Prova ett exempel</div>
              <div style={styles.chips}>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void handleExampleClick(example)}
                    style={styles.chip}
                    aria-label={`Exempel. ${example}`}
                    title={example}
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.answerBox}>
              <div>{formatReply(INITIAL_REPLY, styles)}</div>
            </div>
          </>
        ) : (
          <>
            <section
              style={styles.conversationList}
              aria-label="Samtal med Clara"
              aria-busy={loading}
            >
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} style={styles.userBubble}>
                      {message.content}
                    </div>
                  );
                }

                const isLatestAssistantMessage = latestAssistantMessage?.id === message.id;
                const isSpeaking = speakingMessageId === message.id;

                return (
                  <div key={message.id} style={styles.answerBox}>
                    <div>{formatReply(message.content, styles)}</div>

                    <div style={styles.messageActions}>
                      <button
                        type="button"
                        onClick={() => handleToggleSpeech(message)}
                        style={styles.secondaryButton}
                        aria-label={
                          isSpeaking
                            ? isLatestAssistantMessage
                              ? "Stoppa uppläsning av senaste svaret"
                              : "Stoppa uppläsning av det här tidigare svaret"
                            : isLatestAssistantMessage
                            ? "Läs upp senaste svaret"
                            : "Läs upp det här tidigare svaret"
                        }
                        title={isSpeaking ? "Stoppa uppläsning" : "Läs upp svaret"}
                      >
                        {isSpeaking ? "Stoppa uppläsning" : "Läs upp svaret"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div style={styles.answerBox} aria-label="Clara tänker">
                  <p style={styles.thinkingText}>{THINKING_REPLY}</p>
                </div>
              )}
            </section>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              aria-label="Fortsätt samtalet"
              style={styles.conversationForm}
            >
              <textarea
                id="clara-problem"
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="Skriv nästa fråga eller beskriv mer"
                style={styles.conversationTextarea}
                aria-label="Skriv nästa fråga eller beskriv mer"
              />

              <div style={styles.conversationActions}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    ...styles.primaryButton,
                    ...(!canSubmit ? styles.primaryButtonDisabled : {}),
                  }}
                  aria-label={loading ? "Clara tänker" : "Skicka fråga"}
                  title="Skicka fråga"
                >
                  {loading ? "Clara tänker..." : "Skicka fråga"}
                </button>

                {latestAssistantMessage && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleShareOrSave()}
                      style={styles.secondaryButton}
                      aria-label="Dela eller spara hela samtalet"
                      title="Dela eller spara samtalet"
                    >
                      Dela eller spara samtalet
                    </button>

                    {actionFeedback.messageId === latestAssistantMessage.id &&
                      actionFeedback.text && (
                        <p style={styles.messageFeedback}>{actionFeedback.text}</p>
                      )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleResetConversation}
                  style={styles.secondaryButton}
                  aria-label="Börja om samtalet"
                  title="Börja om samtalet"
                  disabled={loading}
                >
                  Börja om samtalet
                </button>
              </div>
            </form>
          </>
        )}

        <div ref={conversationEndRef} />

        <p
          key={announcement.key}
          style={styles.srOnly}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement.text}
        </p>
      </div>
    </main>
  );
}
