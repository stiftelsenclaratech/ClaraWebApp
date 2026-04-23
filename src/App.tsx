import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import claraLogo from "./clara.png";

const EXAMPLES = [
  "Jag kan inte läsa min post",
  "Jag vet inte vilken burk jag håller i",
  "Jag ser inte om golvet är smutsigt",
];

const INITIAL_REPLY = "Beskriv ditt problem så hjälper jag dig.";
const THINKING_REPLY = "Clara tänker...";
const CLARA_PURPLE = "#6d28d9";

type ThemeMode = "system" | "light" | "dark" | "contrast";
type ConversationRole = "user" | "assistant";

type ApiConversationMessage = {
  role: ConversationRole;
  content: string;
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

async function readReplyFromErrorResponse(response: Response) {
  try {
    const errorData = await response.json();
    if (typeof errorData?.reply === "string" && errorData.reply.trim() !== "") {
      return errorData.reply;
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

  let response: Response | null = null;

  try {
    response = await postClaraRequest({
      problem: latestUserMessage,
      messages,
    });
  } catch {
    response = null;
  }

  if (!response || !response.ok) {
    try {
      const fallbackResponse = await postClaraRequest({
        problem: latestUserMessage,
      });

      if (fallbackResponse.ok || !response) {
        response = fallbackResponse;
      }
    } catch {
      if (!response) {
        return "Kunde inte nå tjänsten just nu.";
      }
    }
  }

  if (!response) {
    return "Kunde inte nå tjänsten just nu.";
  }

  if (response.status === 404) {
    return "API hittades inte. Kör appen med Vercel lokalt (vercel dev) eller publicera till Vercel.";
  }

  if (!response.ok) {
    const reply = await readReplyFromErrorResponse(response);
    return reply || "Kunde inte hämta svar just nu. Försök igen om en stund.";
  }

  const data = await response.json();
  return data.reply || "Fick inget svar. Testa igen.";
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
          href={part}
          target="_blank"
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
    | { type: "paragraph"; value: string }
    | { type: "list"; items: string[]; ordered: boolean }
  > = [];
  let previousLineWasListItem = false;

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

    if (bulletMatch) {
      pushListItem(sanitizeInlineMarkdown(bulletMatch[1]), false);
      previousLineWasListItem = true;
      continue;
    }

    if (numberedMatch) {
      pushListItem(sanitizeInlineMarkdown(numberedMatch[1]), true);
      previousLineWasListItem = true;
      continue;
    }

    const sanitizedLine = sanitizeInlineMarkdown(line);
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

  return blocks.map((block, index) => {
    if (block.type === "heading") {
      return (
        <h3 key={index} style={styles.replyHeading}>
          {block.value}
        </h3>
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

function MenuIcon({ size = 22 }: { size?: number }) {
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
        stroke={CLARA_PURPLE}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" fill={CLARA_PURPLE} />
      <path
        d="M12 1.8V4.2M12 19.8V22.2M4.2 12H1.8M22.2 12H19.8M5.1 5.1L6.8 6.8M17.2 17.2L18.9 18.9M18.9 5.1L17.2 6.8M6.8 17.2L5.1 18.9"
        stroke={CLARA_PURPLE}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ size = 20 }: { size?: number }) {
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
        fill={CLARA_PURPLE}
      />
    </svg>
  );
}

function ContrastIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke={CLARA_PURPLE} strokeWidth="2" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill={CLARA_PURPLE} />
    </svg>
  );
}

function AutoThemeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="12"
        rx="2"
        stroke={CLARA_PURPLE}
        strokeWidth="2"
      />
      <path
        d="M9 20H15"
        stroke={CLARA_PURPLE}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ThemePreviewIcon({
  mode,
  size = 20,
}: {
  mode: ThemeMode;
  size?: number;
}) {
  if (mode === "dark") {
    return <MoonIcon size={size} />;
  }

  if (mode === "contrast") {
    return <ContrastIcon size={size} />;
  }

  if (mode === "system") {
    return <AutoThemeIcon size={size} />;
  }

  return <SunIcon size={size} />;
}

function getThemeLabel(mode: ThemeMode) {
  if (mode === "system") return "Följ systemet";
  if (mode === "dark") return "Mörkt läge";
  if (mode === "contrast") return "Hög kontrast";
  return "Ljust läge";
}

function createStyles(
  activeTheme: Exclude<ThemeMode, "system"> | "light" | "dark" | "contrast",
  textSizeStep: number
): Record<string, CSSProperties> {
  const scale = getFontScale(textSizeStep);
  const isDark = activeTheme === "dark";
  const isContrast = activeTheme === "contrast";

  const pageBackground = isContrast ? "#000000" : isDark ? "#0f172a" : "#f4f6fb";
  const containerBackground = isContrast ? "#000000" : isDark ? "#111827" : "#ffffff";
  const containerBorder = isContrast ? "2px solid #ffffff" : "none";
  const mainText = isContrast ? "#ffffff" : isDark ? "#d1d5db" : "#111827";
  const secondaryText = isContrast ? "#ffffff" : isDark ? "#e5e7eb" : "#374151";
  const mutedText = isContrast ? "#ffffff" : isDark ? "#d1d5db" : "#5b4b73";
  const softPanel = isContrast ? "#000000" : isDark ? "#1f2937" : "#f8fafc";
  const textFieldBg = isContrast ? "#000000" : isDark ? "#1f2937" : "#fcfcff";
  const borderColor = isContrast ? "2px solid #ffffff" : isDark ? "1px solid #374151" : "1px solid #d8d8e2";
  const softBorder = isContrast ? "2px solid #ffffff" : isDark ? "1px solid #374151" : "1px solid #e5e7eb";
  const chipBorder = isContrast ? "2px solid #ffffff" : isDark ? "1px solid #4338ca" : "1px solid #c7d2fe";
  const chipBg = isContrast ? "#000000" : isDark ? "#312e81" : "#eef2ff";
  const chipText = isContrast ? "#ffffff" : isDark ? "#e0e7ff" : "#3730a3";
  const iconBg = isContrast ? "#000000" : isDark ? "#111827" : "#f8fafc";
  const iconBorder = isContrast ? "2px solid #ffffff" : isDark ? "1px solid #374151" : "1px solid #d8d8e2";
  const primaryBg = isContrast
    ? "linear-gradient(135deg, #ffffff 0%, #d1d5db 100%)"
    : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)";
  const primaryText = isContrast ? "#000000" : "#ffffff";
  const boxShadow = isContrast
    ? "none"
    : isDark
    ? "0 12px 32px rgba(0,0,0,0.35)"
    : "0 12px 32px rgba(0,0,0,0.10)";
  const logoShadow = isContrast ? "none" : "0 6px 16px rgba(0,0,0,0.08)";
  const menuShadow = isContrast ? "none" : "0 18px 38px rgba(0,0,0,0.12)";
  const userBubbleBg = isContrast ? "#000000" : isDark ? "#1e3a8a" : "#eef2ff";
  const userBubbleBorder = isContrast ? "2px solid #ffffff" : isDark ? "1px solid #3b82f6" : "1px solid #c7d2fe";
  const subtleText = isContrast ? "#ffffff" : isDark ? "#cbd5e1" : "#4b5563";

  return {
    page: {
      minHeight: "100vh",
      background: pageBackground,
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "32px 16px",
      fontFamily: "system-ui, sans-serif",
    },
    container: {
      width: "100%",
      maxWidth: 480,
      background: containerBackground,
      borderRadius: 24,
      padding: 24,
      boxShadow,
      border: containerBorder,
      textAlign: "center",
      position: "relative",
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      marginBottom: 18,
    },
    topSpacer: {
      justifySelf: "start",
      width: 40,
      height: 40,
    },
    centerLogo: {
      justifySelf: "center",
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#ffffff",
      borderRadius: 18,
      padding: "10px 16px",
      boxShadow: logoShadow,
      border: isContrast ? "2px solid #ffffff" : "none",
    },
    logo: {
      width: 150,
      display: "block",
    },
    menuWrap: {
      justifySelf: "end",
      position: "relative",
    },
    menuButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      border: iconBorder,
      background: iconBg,
      color: CLARA_PURPLE,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    menuPanel: {
      position: "absolute",
      top: 48,
      right: 0,
      width: 230,
      background: softPanel,
      border: softBorder,
      borderRadius: 18,
      boxShadow: menuShadow,
      padding: 14,
      zIndex: 20,
      textAlign: "left",
    },
    panelGroup: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    panelLabel: {
      fontSize: 12 * scale,
      fontWeight: 700,
      color: secondaryText,
    },
    panelDivider: {
      height: 1,
      background: isContrast ? "#ffffff" : isDark ? "#374151" : "#e5e7eb",
      margin: "10px 0",
      border: "none",
    },
    themeOptions: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
    },
    themeOption: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "10px 12px",
      borderRadius: 14,
      border: softBorder,
      background: iconBg,
      color: secondaryText,
      cursor: "pointer",
      textAlign: "left",
      fontSize: 14 * scale,
      fontWeight: 600,
    },
    themeOptionActive: {
      outline: `2px solid ${CLARA_PURPLE}`,
      outlineOffset: 0,
    },
    textRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    sizeButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      border: iconBorder,
      background: iconBg,
      color: CLARA_PURPLE,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      fontWeight: 700,
      lineHeight: 1,
    },
    smallT: {
      fontSize: `${clamp(12 + textSizeStep * 2, 10, 24)}px`,
    },
    largeT: {
      fontSize: `${clamp(20 + textSizeStep * 3, 14, 40)}px`,
    },
    intro: {
      fontSize: 16 * scale,
      lineHeight: 1.5,
      color: mutedText,
      margin: "0 0 18px 0",
    },
    label: {
      display: "block",
      fontSize: 14 * scale,
      fontWeight: 700,
      marginBottom: 10,
      color: secondaryText,
      textAlign: "left",
    },
    textarea: {
      width: "100%",
      minHeight: 120,
      padding: 14,
      borderRadius: 16,
      border: borderColor,
      fontSize: 16 * scale,
      lineHeight: 1.5,
      boxSizing: "border-box",
      resize: "vertical",
      marginBottom: 14,
      background: textFieldBg,
      color: mainText,
      outline: "none",
      fontFamily: "inherit",
    },
    primaryButton: {
      width: "100%",
      padding: "14px 18px",
      borderRadius: 16,
      border: "none",
      background: primaryBg,
      color: primaryText,
      fontSize: 16 * scale,
      fontWeight: 700,
      cursor: "pointer",
    },
    primaryButtonDisabled: {
      opacity: 0.7,
      cursor: "not-allowed",
    },
    examplesWrap: {
      marginTop: 18,
    },
    examplesTitle: {
      fontSize: 14 * scale,
      fontWeight: 700,
      color: secondaryText,
      marginBottom: 10,
    },
    chips: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    chip: {
      padding: "9px 12px",
      borderRadius: 999,
      border: chipBorder,
      background: chipBg,
      color: chipText,
      cursor: "pointer",
      fontSize: 14 * scale,
    },
    answerBox: {
      marginTop: 20,
      background: softPanel,
      borderRadius: 18,
      padding: 18,
      textAlign: "left",
      border: softBorder,
    },
    answerTitle: {
      margin: "0 0 8px 0",
      fontSize: 14 * scale,
      fontWeight: 700,
      color: secondaryText,
    },
    actionsWrap: {
      marginTop: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    secondaryButton: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 16,
      border: chipBorder,
      background: chipBg,
      color: chipText,
      fontSize: 15 * scale,
      fontWeight: 700,
      cursor: "pointer",
    },
    replyHeading: {
      margin: "12px 0 2px 0",
      fontSize: 15 * scale,
      fontWeight: 700,
      color: secondaryText,
    },
    replyParagraph: {
      margin: "0 0 12px 0",
      lineHeight: 1.6,
      color: mainText,
      fontSize: 16 * scale,
    },
    replyList: {
      margin: "0 0 12px 0",
      paddingLeft: 22,
      color: mainText,
      fontSize: 16 * scale,
      lineHeight: 1.6,
    },
    replyListItem: {
      marginBottom: 6,
    },
    replyLink: {
      color: isContrast ? "#ffffff" : "#4f46e5",
      textDecoration: "underline",
      textUnderlineOffset: 2,
      wordBreak: "break-all",
    },
    conversationList: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      marginTop: 20,
      textAlign: "left",
    },
    userBubble: {
      alignSelf: "flex-end",
      maxWidth: "88%",
      padding: "14px 16px",
      borderRadius: 18,
      border: userBubbleBorder,
      background: userBubbleBg,
      color: mainText,
      fontSize: 16 * scale,
      lineHeight: 1.6,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    thinkingText: {
      margin: 0,
      color: subtleText,
      fontSize: 16 * scale,
      lineHeight: 1.6,
    },
    conversationForm: {
      marginTop: 14,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    conversationTextarea: {
      width: "100%",
      minHeight: 96,
      padding: 14,
      borderRadius: 16,
      border: borderColor,
      fontSize: 16 * scale,
      lineHeight: 1.5,
      boxSizing: "border-box",
      resize: "vertical",
      background: textFieldBg,
      color: mainText,
      outline: "none",
      fontFamily: "inherit",
    },
    conversationActions: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    messageActions: {
      marginTop: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    messageFeedback: {
      margin: "2px 0 0 0",
      fontSize: 13 * scale,
      lineHeight: 1.5,
      color: subtleText,
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
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
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

      if (
        savedTheme === "system" ||
        savedTheme === "light" ||
        savedTheme === "dark" ||
        savedTheme === "contrast"
      ) {
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
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = () => {
      setSystemDarkMode(mediaQuery.matches);
    };

    updateTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateTheme);
      return () => mediaQuery.removeEventListener("change", updateTheme);
    }

    mediaQuery.addListener(updateTheme);
    return () => mediaQuery.removeListener(updateTheme);
  }, []);

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

  const resolvedTheme: Exclude<ThemeMode, "system"> =
    themeMode === "system" ? (systemDarkMode ? "dark" : "light") : themeMode;

  const styles = useMemo(
    () => createStyles(resolvedTheme, textSizeStep),
    [resolvedTheme, textSizeStep]
  );

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

  function buildReplyExportText(message: ConversationMessage) {
    const index = messages.findIndex((item) => item.id === message.id);
    const previousUserMessage = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user");

    const sections = [];

    if (previousUserMessage) {
      sections.push(`Din fråga\n${previousUserMessage.content}`);
    }

    sections.push(`Svar från Clara\n${message.content}`);

    return sections.join("\n\n");
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
    link.download = `clara-svar-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  async function handleShareOrSave(message: ConversationMessage) {
    const exportText = buildReplyExportText(message);

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "Svar från Clara",
          text: exportText,
        });
        setActionFeedback({
          messageId: message.id,
          text: "Delningsmenyn öppnades.",
        });
        return;
      }

      saveReplyToFile(exportText);
      setActionFeedback({
        messageId: message.id,
        text: "Svaret sparades som en textfil.",
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
            messageId: message.id,
            text: "Svaret kopierades till urklipp.",
          });
          return;
        }
      } catch {
        // ignore clipboard fallback errors
      }

      setActionFeedback({
        messageId: message.id,
        text: "Det gick inte att dela eller spara svaret just nu.",
      });
    }
  }

  return (
    <main style={styles.page} aria-label="Clara hjälpmedelsassistent">
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.topSpacer} />

          <div style={styles.centerLogo}>
            <img src={claraLogo} alt="Clara" style={styles.logo} />
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
              <MenuIcon size={22} />
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
                    {(["system", "light", "dark", "contrast"] as ThemeMode[]).map(
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
                          <ThemePreviewIcon mode={mode} size={20} />
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
              <p style={styles.answerTitle}>Svar</p>
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

                    {isLatestAssistantMessage && (
                      <>
                        <div style={styles.messageActions}>
                          <button
                            type="button"
                            onClick={() => handleToggleSpeech(message)}
                            style={styles.secondaryButton}
                            aria-label={
                              isSpeaking
                                ? "Stoppa uppläsning av senaste svaret"
                                : "Läs upp senaste svaret"
                            }
                            title={isSpeaking ? "Stoppa uppläsning" : "Läs upp svaret"}
                          >
                            {isSpeaking ? "Stoppa uppläsning" : "Läs upp svaret"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleShareOrSave(message)}
                            style={styles.secondaryButton}
                            aria-label="Dela eller spara senaste svaret"
                            title="Dela eller spara svaret"
                          >
                            Dela eller spara
                          </button>
                        </div>

                        {actionFeedback.messageId === message.id && actionFeedback.text && (
                          <p style={styles.messageFeedback}>{actionFeedback.text}</p>
                        )}
                      </>
                    )}
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
