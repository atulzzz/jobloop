import {
  app,
  BrowserWindow,
  ipcMain
} from "electron";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { BrowserController } from "./browser-controller.mjs";
import { registerIpc } from "./ipc.mjs";

const require = createRequire(import.meta.url);
const channels = require("../shared/ipc-channels.json");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const START_URL = process.env.JOBLOOP_START_URL ?? "https://www.zhipin.com/";
const SESSION_PARTITION = "persist:jobloop-recruitment";
const DEFAULT_WINDOW = { width: 1480, height: 960 };

let mainWindow = null;
let browserController = null;

function sendNavigationState(state) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(
    channels.browserNavigationState,
    state
  );
}

function scheduleSmokeTest() {
  if (process.env.JOBLOOP_SMOKE_TEST !== "1" || !mainWindow) {
    return;
  }

  const startedAt = Date.now();

  const attemptCapture = async () => {
    try {
      if (!browserController) {
        throw new Error("Browser controller is unavailable.");
      }

      if (browserController.getState().isLoading) {
        if (Date.now() - startedAt < 25000) {
          setTimeout(attemptCapture, 500);
          return;
        }

        throw new Error("Timed out waiting for the recruitment page.");
      }

      const result = await mainWindow?.webContents.executeJavaScript(
        "window.jobloop.browser.capture()"
      );

      if (!result?.ok) {
        throw new Error(result?.error?.message ?? "Unknown IPC failure.");
      }

      console.log(
        "JOBLOOP_SMOKE_CAPTURE",
        JSON.stringify({
          title: result.data?.title,
          url: result.data?.url,
          characterCount: result.data?.characterCount,
          salaryText: result.data?.salaryText,
          salaryObfuscated: result.data?.salaryObfuscated,
          privateUseCharacterCount: result.data?.privateUseCharacterCount,
          hasText: Boolean(result.data?.text)
        })
      );
    } catch (error) {
      console.error("JOBLOOP_SMOKE_ERROR", error);
      process.exitCode = 1;
      app.quit();
      return;
    }

    app.quit();
  };

  setTimeout(attemptCapture, 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f4f1e9",
    title: "JobLoop - D2 IPC",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  browserController = new BrowserController({
    mainWindow,
    partition: SESSION_PARTITION,
    startUrl: START_URL,
    onNavigationState: sendNavigationState
  });

  mainWindow.on("closed", () => {
    browserController?.dispose();
    browserController = null;
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.once("did-finish-load", scheduleSmokeTest);
  browserController.create();
}

app.whenReady().then(() => {
  registerIpc({
    ipcMain,
    channels,
    getMainWindow: () => mainWindow,
    getBrowserController: () => browserController,
    appInfo: () => ({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      platform: process.platform,
      sessionPartition: SESSION_PARTITION
    })
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
