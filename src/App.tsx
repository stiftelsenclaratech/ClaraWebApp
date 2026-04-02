import { useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const examples = [
    "Jag kan inte läsa min post",
    "Jag vet inte vilken burk jag håller i",
    "Jag ser inte om golvet är smutsigt",
  ];

  const send = async (text?: string) => {
    const problem = text || input;
    if (!problem) return;

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
    } catch (e) {
      setReply("Kunde inte nå tjänsten.");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Clara</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Till exempel: Jag kan inte läsa min post"
        style={styles.textarea}
      />

      <button style={styles.button} onClick={() => send()}>
        Få hjälp
      </button>

      <div style={styles.examples}>
        {examples.map((ex, i) => (
          <button
            key={i}
            style={styles.exampleButton}
            onClick={() => {
              setInput(ex);
              send(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {loading && <p>Laddar...</p>}

      {reply && (
        <div style={styles.reply}>
          {reply}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 500,
    margin: "40px auto",
    padding: 20,
    fontFamily: "sans-serif",
  },

  title: {
    fontSize: 32,
    marginBottom: 20,
  },

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
    color: "#111827",
  },

  button: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: "none",
    background: "#4f46e5",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 16,
  },

  examples: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginBottom: 20,
  },

  exampleButton: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    textAlign: "left" as const,
  },

  reply: {
    padding: 16,
    borderRadius: 16,
    background: "#f3f4f6",
    whiteSpace: "pre-wrap" as const,
  },
};