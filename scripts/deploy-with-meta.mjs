import { spawn } from "node:child_process";

const note = process.argv.slice(2).join(" ").trim();

if (!note) {
  console.error(
    "Ange en kort andringsnotis. Exempel: npm run deploy:prod -- \"Forbattrad lankvisning i svar\""
  );
  process.exit(1);
}

const args = [
  "--prod",
  "--yes",
  "--meta",
  `changes=${note}`,
];

const child = spawn("vercel", args, {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
