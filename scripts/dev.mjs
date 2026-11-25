import { spawn } from "node:child_process";
import electronPath from "electron";
import { createServer } from "vite";

const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});

await server.listen();

const localUrl = server.resolvedUrls?.local?.[0] ?? "http://127.0.0.1:5173/";
const electron = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: localUrl
  }
});

let closing = false;

async function shutdown(exitCode = 0) {
  if (closing) {
    return;
  }

  closing = true;
  await server.close();
  process.exit(exitCode);
}

electron.on("exit", (code) => {
  void shutdown(code ?? 0);
});

process.on("SIGINT", () => {
  electron.kill();
  void shutdown(0);
});

process.on("SIGTERM", () => {
  electron.kill();
  void shutdown(0);
});
