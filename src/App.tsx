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
    background: "linear-gradient(180deg, #f6f7fb 0%, #eef2ff 100%)",
    padding: "24px 16px 40px",
    fontFamily: "Arial, sans-serif",
    color: "#1f2937",
  } as React.CSSProperties,
  shell: {
    maxWidth: 480,
    margin: "0 auto",
  } as React.CSSProperties,
  logoWrap: {
    textAlign: "center" as const,
    marginBottom: 20,
  } as React.CSSProperties,
  logo: {
    maxWidth: 180,
    width: "100%",
    height: "auto",
  } as React.CSSProperties,
  card: {
    background: "#ffffff",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.10)",
    border: "1px solid rgba(99, 102, 241, 0.10)",
  } as React.CSSProperties,
  intro: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "#4b5563",
    margin: "0 0 18px 0",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    color: "#374151",
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: 140,
    resize: "vertical" as const,
    borderRadius: 18,
    border: "1px solid #d1d5db",
    padding: 16,
    fontSize: 16,
    lineHeight: 1.5,
    boxSizing: "border-box" as const,
    outline: "none",
    background: "#fcfcff",
  } as React.CSSProperties,
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: 18,
    padding: "15px 18px",
    fontSize: 16,
    fontWeight: 700,
    color: "white",
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(79, 70, 229, 0.30)",
    marginTop: 12,
  } as React.CSSProperties,
  section: {
    marginTop: 22,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 10,
  } as React.CSSProperties,
  chipWrap: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  chip: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 14,
    cursor: "pointer",
  } as React.CSSProperties,
  answerCard: {
    marginTop: 22,
    background: "#f8fafc",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
  } as React.CSSProperties,
  answerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 8,
  } as React.CSSProperties,
  answerText: {
    margin: 0,
    whiteSpace: "pre-line" as const,
    lineHeight: 1.6,
    fontSize: 16,
    color: "#111827",
  } as React.CSSProperties,
  secondaryButton: {
    width: "100%",
    border: "1px solid #c7d2fe",
    borderRadius: 18,
    padding: "13px 18px",
    fontSize: 15,
    fontWeight: 700,
    color: "#3730a3",
    background: "#eef2ff",
    cursor: "pointer",
    marginTop: 12,
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
    setShowExamples(false);
    setProblem(example);
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
      <div style={styles.shell}>
        <div style={styles.logoWrap}>
          <img src={claraLogo} alt="logo" style={styles.logo} />
        </div>

        <div style={styles.card}>
          <p style={styles.intro}>Beskriv ditt problem så får du ett tydligt teknikförslag.</p>

          <label style={styles.label}>Beskriv ditt problem</label>
          <textarea
            value={problem}
            onChange={(e) => {
              setProblem(e.target.value);
            }}
            placeholder="Till exempel: Jag kan inte läsa min post"
            style={styles.textarea}
          />

          <button onClick={handleSubmit} disabled={loading} style={styles.primaryButton}>
            {loading ? "Clara tänker..." : "Få hjälp"}
          </button>

          {showExamples && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Prova ett exempel</div>
              <div style={styles.chipWrap}>
                {EXAMPLES.map((example) => (
                  <button key={example} onClick={() => void handleExampleClick(example)} style={styles.chip}>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={styles.answerCard}>
            <div style={styles.answerTitle}>Svar</div>
            <p style={styles.answerText}>{reply}</p>
          </div>

          {!showExamples && (
            <button onClick={() => setShowExamples(true)} style={styles.secondaryButton}>
              Visa exempel igen
            </button>
          )} style={styles.secondaryButton}>
              Visa exempel igen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
