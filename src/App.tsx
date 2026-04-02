import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import claraLogo from "./clara.png";

const EXAMPLES = [
  "Jag kan inte läsa min post",
  "Jag vet inte vilken burk jag håller i",
  "Jag ser inte om golvet är smutsigt",
];

const INITIAL_REPLY = "Beskriv ditt problem så hjälper jag dig.";
const THINKING_REPLY = "Clara tänker...";
const CLARA_PURPLE = "#6d28d9";

type ThemeMode = "system" | "light" | "dark";

async function getClaraReplyFromAPI(input: string): Promise<string> {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return "Beskriv ditt problem kort så hjälper jag dig.";
  }

  try {
    const response = await fetch("/api/clara", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ problem: trimmedInput }),
    });

    if (!response.ok) {
      return "Kunde inte hämta svar just nu.";
    }

    const data = await response.json();
    return data.reply || "Fick inget svar. Testa igen.";
  } catch {
    return "Kunde inte nå tjänsten just nu.";
  }
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
  const headingLines = [
    "Problem",
    "Första steg",
    "Fler möjligheter",
    "Teknik",
    "Det här kan hjälpa dig",
    "Enkelt att börja med",
    "Bra att veta",
  ];

  const lines = reply.split("\n").map((line) => line.trim());

  return lines
    .filter((line) => line !== "")
    .map((line, index) => {
      const isHeading = headingLines.some(
        (heading) => line.toLowerCase() === heading.toLowerCase()
      );

      if (isHeading) {
        return (
          <h3
            key={index}
            style={styles.replyHeading}
            role="heading"
            aria-level={2}
          >
            {line}
          </h3>
        );
      }

      return (
        <p key={index} style={styles.replyParagraph}>
          {line}
        </p>
      );
    });
}

function SunIcon({ size = 22 }: { size?: number }) {
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

function MoonIcon({ size = 22 }: { size?: number }) {
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

function createStyles(
  isDarkMode: boolean,
  textSizeStep: number
): Record<string, CSSProperties> {
  const scale = getFontScale(textSizeStep);

  return {
    page: {
      minHeight: "100vh",
      background: isDarkMode ? "#0f172a" : "#f4f6fb",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      padding: "32px 16px",
      fontFamily: "system-ui, sans-serif",
    },
    container: {
      width: "100%",
      maxWidth: 480,
      background: isDarkMode ? "#111827" : "#ffffff",
      borderRadius: 24,
      padding: 24,
      boxShadow: isDarkMode
        ? "0 12px 32px rgba(0,0,0,0.35)"
        : "0 12px 32px rgba(0,0,0,0.10)",
      textAlign: "center",
    },
    topBar: {
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      gap: 12,
      marginBottom: 18,
    },
    leftControls: {
      justifySelf: "start",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    centerLogo: {
      justifySelf: "center",
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#ffffff",
      borderRadius: 18,
      padding: "10px 16px",
      boxShadow: isDarkMode
        ? "0 8px 20px rgba(0,0,0,0.25)"
        : "0 6px 16px rgba(0,0,0,0.08)",
    },
    rightControls: {
      justifySelf: "end",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    logo: {
      width: 150,
      display: "block",
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      border: isDarkMode ? "1px solid #374151" : "1px solid #d8d8e2",
      background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
      color: CLARA_PURPLE,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(4px)",
    },
    sizeButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      border: isDarkMode ? "1px solid #374151" : "1px solid #d8d8e2",
      background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
      color: isDarkMode ? "#e0e7ff" : "#3730a3",
      fontSize: 22 * scale,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      flexShrink: 0,
      backdropFilter: "blur(4px)",
    },
    sizePreview: {
      width: 46,
      height: 36,
      borderRadius: 12,
      border: isDarkMode ? "1px solid #374151" : "1px solid #d8d8e2",
      background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.55)",
      color: CLARA_PURPLE,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      fontWeight: 800,
      fontSize: `${clamp(16 + textSizeStep * 4, 12, 60)}px`,
      lineHeight: 1,
      backdropFilter: "blur(4px)",
    },
    intro: {
      fontSize: 16 * scale,
      lineHeight: 1.5,
      color: isDarkMode ? "#d1d5db" : "#5b4b73",
      margin: "0 0 18px 0",
    },
    label: {
      display: "block",
      fontSize: 14 * scale,
      fontWeight: 700,
      marginBottom: 10,
      color: isDarkMode ? "#f3f4f6" : "#2d2d2d",
      textAlign: "left",
    },
    textarea: {
      width: "100%",
      minHeight: 120,
      padding: 14,
      borderRadius: 16,
      border: isDarkMode ? "1px solid #374151" : "1px solid #d8d8e2",
      fontSize: 16 * scale,
      lineHeight: 1.5,
      boxSizing: "border-box",
      resize: "vertical",
      marginBottom: 14,
      background: isDarkMode ? "#1f2937" : "#fcfcff",
      color: isDarkMode ? "#f9fafb" : "#111827",
      outline: "none",
    },
    primaryButton: {
      width: "100%",
      padding: "14px 18px",
      borderRadius: 16,
      border: "none",
      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
      color: "#ffffff",
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
      color: isDarkMode ? "#e5e7eb" : "#374151",
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
      border: isDarkMode ? "1px solid #4338ca" : "1px solid #c7d2fe",
      background: isDarkMode ? "#312e81" : "#eef2ff",
      color: isDarkMode ? "#e0e7ff" : "#3730a3",
      cursor: "pointer",
      fontSize: 14 * scale,
    },
    answerBox: {
      marginTop: 20,
      background: isDarkMode ? "#1f2937" : "#f8fafc",
      borderRadius: 18,
      padding: 18,
      textAlign: "left",
      border: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
    },
    answerTitle: {
      margin: "0 0 8px 0",
      fontSize: 14 * scale,
      fontWeight: 700,
      color: isDarkMode ? "#e5e7eb" : "#374151",
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
      border: isDarkMode ? "1px solid #4338ca" : "1px solid #c7d2fe",
      background: isDarkMode ? "#312e81" : "#eef2ff",
      color: isDarkMode ? "#e0e7ff" : "#3730a3",
      fontSize: 15 * scale,
      fontWeight: 700,
      cursor: "pointer",
    },
    replyHeading: {
      margin: "12px 0 4px 0",
      fontSize: 15 * scale,
      fontWeight: 600,
      color: isDarkMode ? "#f3f4f6" : "#222222",
    },
    replyParagraph: {
      margin: "0 0 12px 0",
      lineHeight: 1.6,
      color: isDarkMode ? "#d1d5db" : "#111827",
      fontSize: 16 * scale,
    },
  };
}

export default function App() {
  const [problem, setProblem] = useState("");
  const [reply, setReply] = useState(INITIAL_REPLY);
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [manualTheme, setManualTheme] = useState<ThemeMode>("system");
  const [textSizeStep, setTextSizeStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedTheme = window.localStorage.getItem("clara-theme");
      const savedTextSize = window.localStorage.getItem("clara-text-size");

      if (
        savedTheme === "system" ||
        savedTheme === "light" ||
        savedTheme === "dark"
      ) {
        setManualTheme(savedTheme);
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
      window.localStorage.setItem("clara-theme", manualTheme);
    } catch {
      // ignore localStorage errors
    }
  }, [manualTheme]);

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

  const isDarkMode =
    manualTheme === "dark" ||
    (manualTheme === "system" && systemDarkMode);

  const styles = useMemo(
    () => createStyles(isDarkMode, textSizeStep),
    [isDarkMode, textSizeStep]
  );

  const showReadButton = useMemo(() => {
    return !loading && reply !== "" && reply !== INITIAL_REPLY && reply !== THINKING_REPLY;
  }, [loading, reply]);

  async function runQuery(input: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(false);
    setShowExamples(false);
    setLoading(true);
    setReply(THINKING_REPLY);

    try {
      const result = await getClaraReplyFromAPI(input);
      setReply(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    await runQuery(problem);
  }

  async function handleExampleClick(example: string) {
    setProblem(example);
    await runQuery(example);
  }

  function handleShowExamplesAgain() {
    setShowExamples(true);
    setProblem("");
    setReply(INITIAL_REPLY);
    setIsSpeaking(false);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function handleToggleSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!reply || reply === INITIAL_REPLY || reply === THINKING_REPLY) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(reply);
    const bestVoice = getBestSwedishVoice();

    utterance.text = reply;
    utterance.lang = "sv-SE";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = bestVoice.lang;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synth.cancel();
    synth.speak(utterance);
    setIsSpeaking(true);
  }

  function increaseTextSize() {
    setTextSizeStep((prev) => clamp(prev + 1, -4, 10));
  }

  function decreaseTextSize() {
    setTextSizeStep((prev) => clamp(prev - 1, -4, 10));
  }

  function toggleTheme() {
    if (manualTheme === "system") {
      setManualTheme(systemDarkMode ? "light" : "dark");
      return;
    }

    if (manualTheme === "light") {
      setManualTheme("dark");
      return;
    }

    setManualTheme("light");
  }

  function getThemeAriaLabel() {
    if (isDarkMode) {
      return "Mörkt läge är aktivt. Aktivera ljust läge.";
    }

    return "Ljust läge är aktivt. Aktivera mörkt läge.";
  }

  function getTextSizeDescription() {
    return `Textstorlek nivå ${textSizeStep + 5} av 15.`;
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.leftControls}>
            <button
              type="button"
              onClick={decreaseTextSize}
              style={styles.sizeButton}
              aria-label={`Minska textstorleken. ${getTextSizeDescription()}`}
              title="Minska textstorleken"
            >
              −
            </button>

            <div
              style={styles.sizePreview}
              aria-live="polite"
              aria-label={getTextSizeDescription()}
            >
              T
            </div>

            <button
              type="button"
              onClick={increaseTextSize}
              style={styles.sizeButton}
              aria-label={`Öka textstorleken. ${getTextSizeDescription()}`}
              title="Öka textstorleken"
            >
              +
            </button>
          </div>

          <div style={styles.centerLogo}>
            <img src={claraLogo} alt="Clara" style={styles.logo} />
          </div>

          <div style={styles.rightControls}>
            <button
              type="button"
              onClick={toggleTheme}
              style={styles.iconButton}
              aria-label={getThemeAriaLabel()}
              title={getThemeAriaLabel()}
            >
              {isDarkMode ? <SunIcon size={24} /> : <MoonIcon size={24} />}
            </button>
          </div>
        </div>

        <p style={styles.intro}>
          Beskriv ditt problem så får du ett tydligt teknikförslag.
        </p>

        <label htmlFor="clara-problem" style={styles.label}>
          Beskriv ditt problem
        </label>

        <textarea
          id="clara-problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Till exempel: Jag kan inte läsa min post"
          style={styles.textarea}
          aria-label="Beskriv ditt problem"
        />

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading}
          style={{
            ...styles.primaryButton,
            ...(loading ? styles.primaryButtonDisabled : {}),
          }}
          aria-label={loading ? "Clara tänker" : "Få hjälp"}
          title="Få hjälp"
        >
          {loading ? "Clara tänker..." : "Få hjälp"}
        </button>

        {showExamples && (
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
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.answerBox} aria-live="polite">
          <p style={styles.answerTitle}>Svar</p>
          <div>{formatReply(reply, styles)}</div>
        </div>

        <div style={styles.actionsWrap}>
          {showReadButton && (
            <button
              type="button"
              onClick={handleToggleSpeech}
              style={styles.secondaryButton}
              aria-label={
                isSpeaking
                  ? "Sluta läsa upp svaret"
                  : "Läs upp svaret med talsyntes"
              }
              title={isSpeaking ? "Sluta läsa upp" : "Läs upp svaret"}
            >
              {isSpeaking ? "Sluta läs upp" : "Läs upp svaret"}
            </button>
          )}

          {!showExamples && (
            <button
              type="button"
              onClick={handleShowExamplesAgain}
              style={styles.secondaryButton}
              aria-label="Visa exempel igen"
              title="Visa exempel igen"
            >
              Visa exempel igen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}