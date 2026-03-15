import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return {};
  }

  const raw = readFileSync(envPath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      return key ? [key, value] : null;
    })
    .filter((entry) => entry !== null);

  return Object.fromEntries(entries);
}

const env = {
  ...process.env,
  ...loadLocalEnv(),
};

const children = [
  spawn(process.execPath, ["server/events-proxy.mjs"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  }),
];

function shutdown(signal = "SIGTERM") {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

children.forEach((child) => {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});
