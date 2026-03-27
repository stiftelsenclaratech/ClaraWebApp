import { useState } from "react";
import claraLogo from "./clara.png";

const EXAMPLES = [
  "Jag kan inte läsa min post",
  "Jag vet inte vilken burk jag håller i",
  "Jag ser inte om golvet är smutsigt",
];

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

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "32px 16px",
    fontFamily: "system-ui, sans-serif",
  } as React.CSSProperties,
  container: {
    width: "100%",
    maxWidth: 430,
    background: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 12px 32px rgba(0,0,0,0.10)",
    textAlign: "center" as const,
  } as React.CSSProperties,
  logo: {
    width: 170,
    marginBottom: 12,
  } as React.CSSProperties,
  intro: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "#5b4b73",
    margin: "0 0 18px 0",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
    color: "#2d2d2d",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 120,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #d8d8e2",
    fontSize: 16,
    lineHeight: 1.5,
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    marginBottom: 14,
    background: "#fcfcff",
  } as React.CSSProperties,
  button: {
    width: "100%",
    padding: "14px 18px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(79, 70, 229, 0.28)",
  } as React.CSSProperties,
  examplesWrap: {
    marginTop: 18,
  } as React.CSSProperties,
  examplesTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 10,
  } as React.CSSProperties,
  chips: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
  } as React.CSSProperties,
  chip: {
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    cursor: "pointer",
    fontSize: 14,
  } as React.CSSProperties,
  answerBox: {
    marginTop: 20,
    background: "#f8fafc",
    borderRadius: 18,
    padding: 18,
    textAlign: "left" as const,
    border: "1px solid #e5e7eb",
  } as React.CSSProperties,
  answerTitle: {
    margin: "0 0 8px 0",
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
  } as React.CSSProperties,
  answerText: {
    margin: 0,
    lineHeight: 1.6,
    whiteSpace: "pre-line" as const,
    color: "#111827",
    fontSize: 16,
  } as React.CSSProperties,
  secondaryButton: {
    width: "100%",
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
};

export default function App() {
  const [problem, setProblem] = useState("");
  const [reply, setReply] = useState("Beskriv ditt problem så hjälper jag dig.");
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);

  async function handleSubmit() {
    setShowExamples(false);
    setLoading(true);
    setReply("Clara tänker...");

    try {
      const result = await getClaraReplyFromAPI(problem);
      setReply(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleExampleClick(example: string) {
    setProblem(example);
    setShowExamples(false);
    setLoading(true);
    setReply("Clara tänker...");

    try {
      const result = await getClaraReplyFromAPI(example);
      setReply(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <img src={claraLogo} alt="logo" style={styles.logo} />

        <p style={styles.intro}>Beskriv ditt problem så får du ett tydligt teknikförslag.</p>

        <label style={styles.label}>Beskriv ditt problem</label>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Till exempel: Jag kan inte läsa min post"
          style={styles.textarea}
        />

        <button onClick={() => void handleSubmit()} disabled={loading} style={styles.button}>
          {loading ? "Clara tänker..." : "Få hjälp"}
        </button>

        {showExamples && (
          <div style={styles.examplesWrap}>
            <div style={styles.examplesTitle}>Prova ett exempel</div>
            <div style={styles.chips}>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => void handleExampleClick(example)}
                  style={styles.chip}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={styles.answerBox}>
          <p style={styles.answerTitle}>Svar</p>
          <p style={styles.answerText}>{reply}</p>
        </div>

        {!showExamples && (
          <button onClick={() => setShowExamples(true)} style={styles.secondaryButton}>
            Visa exempel igen
          </button>
        )}
      </div>
    </div>
  );
}
