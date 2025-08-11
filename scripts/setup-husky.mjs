import { execSync } from "child_process";
import fs from "fs";

try {
  execSync("npx husky init", { stdio: "inherit" });
  const hook = `#!/usr/bin/env bash
npm run check
`;
  fs.writeFileSync(".husky/pre-commit", hook, { encoding: "utf8" });
  console.log("Husky pre-commit hook installed.");
} catch (e) {
  console.error("Failed to initialize Husky. Ensure git is initialized and try again.");
  process.exit(1);
}
