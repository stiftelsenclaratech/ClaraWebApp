import { useState } from "react";
import type { CSSProperties } from "react";

function formatReply(reply: string) {
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

export default function App() {
  const [problem, setProblem] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!problem.trim()) return;

    setLoading(true);
    setReply("");

    try {
      const res = await fetch("/api/clara", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ problem }),
      });

      const data = await res.json();
      setReply(data.reply);
    } catch (error) {
      setReply("Kunde inte hämta svar just nu.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Clara</h1>

      <textarea
        style={styles.textarea}
        placeholder="Beskriv ditt problem..."
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
      />

      <button style={styles.button} onClick={handleSubmit}>
        Få hjälp
      </button>

      {loading && <p style={styles.loading}>Laddar...</p>}

      {reply && (
        <div style={styles.answerBox}>
          <div>{formatReply(reply)}</div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: CSSProperties } = {
  container: {
    maxWidth: 600,
    margin: "40px auto",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 20,
  },

  textarea: {
    width: "100%",
    height: 100,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
  },

  button: {
    padding: "10px 16px",
    fontSize: 16,
    borderRadius: 8,
    border: "none",
    backgroundColor: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
  },

  loading: {
    marginTop: 12,
    color: "#555",
  },

  answerBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
  },

  replyHeading: {
    margin: "16px 0 6px 0",
    fontSize: 17,
    fontWeight: 800,
    color: "#111111",
  },

  replyParagraph: {
    margin: "0 0 12px 0",
    lineHeight: 1.6,
    color: "#111827",
    fontSize: 16,
  },
};