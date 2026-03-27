import { useState } from "react";
import claraLogo from "./clara.png";

const EXAMPLES = [
  "Jag kan inte läsa min post",
  "Jag vet inte vilken burk jag håller i",
  "Jag ser inte om golvet är smutsigt",
];

async function getClaraReplyFromAPI(input: string): Promise<string> {
  if (!input.trim()) {
    return "Beskriv ditt problem kort så hjälper jag dig.";
  }

  try {
    const response = await fetch("/api/clara", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ problem: input }),
    });

    const data = await response.json();
    return data.reply || "Fick inget svar.";
  } catch {
    return "Kunde inte nå tjänsten.";
  }
}

export default function App() {
  const [problem, setProblem] = useState("");
  const [reply, setReply] = useState("Beskriv ditt problem så hjälper jag dig.");
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);

  async function handleSubmit() {
    setShowExamples(false);
    setLoading(true);
    setReply("Clara tänker...");

    const result = await getClaraReplyFromAPI(problem);

    setReply(result);
    setLoading(false);
  }

  async function handleExampleClick(example: string) {
    setProblem(example);
    handleSubmit();
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <img src={claraLogo} style={styles.logo} />

        <h1 style={styles.title}>Få hjälp med vardagen</h1>
        <p style={styles.subtitle}>
          Beskriv ditt problem så får du ett tydligt teknikförslag
        </p>

        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="Till exempel: Jag kan inte läsa min post"
          style={styles.textarea}
        />

        <button onClick={handleSubmit} style={styles.button}>
          {loading ? "Clara tänker..." : "Få hjälp"}
        </button>

        {showExamples && (
          <div style={styles.examples}>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => handleExampleClick(e)} style={styles.chip}>
                {e}
              </button>
            ))}
          </div>
        )}

        <div style={styles.answerBox}>
          <h3 style={styles.answerTitle}>Svar</h3>
          <p style={styles.answerText}>{reply}</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "system-ui",
  },
  container: {
    width: "100%",
    maxWidth: 420,
    background: "white",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    textAlign: "center" as const,
  },
  logo: {
    width: 140,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 20,
  },
  textarea: {
    width: "100%",
    minHeight: 100,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "#5b5ce6",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 16,
  },
  examples: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  chip: {
    padding: "8px 12px",
    borderRadius: 20,
    border: "1px solid #ccc",
    background: "#f1f3f8",
    cursor: "pointer",
    fontSize: 13,
  },
  answerBox: {
    background: "#f9fafc",
    borderRadius: 12,
    padding: 16,
    textAlign: "left" as const,
  },
  answerTitle: {
    marginBottom: 6,
  },
  answerText: {
    margin: 0,
    lineHeight: 1.5,
  },
};