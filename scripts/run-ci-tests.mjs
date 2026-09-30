import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const sourceUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
const targetUrl = process.env.TEST_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("Set EXTERNAL_DATABASE_URL and TEST_DATABASE_URL.");

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? `signal ${signal}`}`));
    });
  });
}

const root = fileURLToPath(new URL("..", import.meta.url));
const prepareEnv = { ...process.env, EXTERNAL_DATABASE_URL: sourceUrl, TEST_DATABASE_URL: targetUrl };
await run(process.execPath, [`${root}/scripts/prepare-test-db.mjs`], prepareEnv);

const testEnv = { ...process.env, EXTERNAL_DATABASE_URL: targetUrl, DATABASE_URL: targetUrl };
await run("pnpm", ["exec", "vitest", "run"], testEnv);
