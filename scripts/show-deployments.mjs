import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "DEPLOYMENTS.md");

try {
  const content = readFileSync(filePath, "utf8");
  console.log(content);
} catch {
  console.error("Kunde inte läsa DEPLOYMENTS.md.");
  process.exit(1);
}
