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

    const data = await response.json();
    return data.reply || "Fick inget svar. Testa igen.";
  } catch {
    return "Kunde inte nå tjänsten just nu.";
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
    setShowExamples(false);
    setProblem(example);
    setLoading(true);
    setReply("Clara tänker...");

    const result = await getClaraReplyFromAPI(example);

    setReply(result);
    setLoading(false);
  }

  return (
    <div style={{ padding: 20 }}>
      <img src={claraLogo} alt="logo" style={{ width: 150 }} />

      <p>Beskriv ditt problem så får du ett tydligt teknikförslag.</p>

      <textarea
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        placeholder="Till exempel: Jag kan inte läsa min post"
      />

      <br />

      <button onClick={handleSubmit}>
        {loading ? "Clara tänker..." : "Få hjälp"}
      </button>

      {showExamples && (
        <div>
          {EXAMPLES.map((example) => (
            <button key={example} onClick={() => handleExampleClick(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      <h3>Svar</h3>
      <p>{reply}</p>
    </div>
  );
}