import { spawn } from "node:child_process";
import electronPath from "electron";

const electron = spawn(electronPath, ["."], {
  stdio: "inherit",
  env: {
    ...process.env,
    JOBLOOP_SMOKE_TEST: "1"
  }
});

const timeout = setTimeout(() => {
  console.error("JOBLOOP_SMOKE_TIMEOUT");
  electron.kill();
  process.exitCode = 1;
}, 30000);

electron.on("exit", (code) => {
  clearTimeout(timeout);
  process.exitCode = code ?? 1;
});
