import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  WebContentsView
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const START_URL = process.env.JOBLOOP_START_URL ?? "https://www.zhipin.com/";
const SESSION_PARTITION = "persist:jobloop-recruitment";
const DEFAULT_WINDOW = { width: 1480, height: 960 };

let mainWindow = null;
let browserView = null;
let browserBounds = { x: 0, y: 80, width: 1000, height: 800 };

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    throw new Error("请输入网址。");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  if (!isHttpUrl(withProtocol)) {
    throw new Error("只支持 HTTP 或 HTTPS 网址。");
  }

  return new URL(withProtocol).toString();
}

function sanitizeBounds(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const width = Math.floor(Number(value.width));
  const height = Math.floor(Number(value.height));
  const x = Math.floor(Number(value.x));
  const y = Math.floor(Number(value.y));

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(0, width),
    height: Math.max(0, height)
  };
}

function sendNavigationState(overrides = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !browserView) {
    return;
  }

  const contents = browserView.webContents;
  const state = {
    url: contents.getURL() || START_URL,
    title: contents.getTitle() || "招聘网站",
    isLoading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    ...overrides
  };

  mainWindow.webContents.send("browser:navigation-state", state);
}

function assertTrustedSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Unauthorized IPC sender.");
  }
}

function createBrowserView() {
  const recruitmentSession = session.fromPartition(SESSION_PARTITION);

  recruitmentSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  browserView = new WebContentsView({
    webPreferences: {
      session: recruitmentSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  browserView.setBackgroundColor("#f4f1e9");
  mainWindow.contentView.addChildView(browserView);
  browserView.setBounds(browserBounds);

  const contents = browserView.webContents;

  contents.on("did-start-loading", () => sendNavigationState({ isLoading: true }));
  contents.on("did-stop-loading", () => sendNavigationState({ isLoading: false }));
  contents.on("did-navigate", () => sendNavigationState());
  contents.on("did-navigate-in-page", () => sendNavigationState());
  contents.on("page-title-updated", () => sendNavigationState());
  contents.on("did-fail-load", (_event, code, description, validatedUrl) => {
    if (code === -3) {
      return;
    }

    sendNavigationState({
      isLoading: false,
      title: "页面加载失败",
      error: `${description} (${code})`,
      url: validatedUrl || contents.getURL()
    });
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  void contents.loadURL(START_URL);
}

async function captureCurrentPage() {
  if (!browserView) {
    throw new Error("招聘网站浏览器尚未初始化。");
  }

  const contents = browserView.webContents;

  if (contents.isLoading()) {
    throw new Error("页面仍在加载，请稍后再试。");
  }

  const result = await contents.executeJavaScript(
    `(() => {
      const text = (document.body?.innerText ?? "")
        .replace(/\\u00a0/g, " ")
        .replace(/[ \\t]+/g, " ")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();

      const metaDescription =
        document.querySelector('meta[name="description"]')?.getAttribute("content") ??
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
        "";

      return {
        title: document.title.trim(),
        url: window.location.href,
        description: metaDescription.trim(),
        text: text.slice(0, 50000),
        characterCount: text.length,
        capturedAt: new Date().toISOString()
      };
    })()`,
    true
  );

  return result;
}

function registerIpc() {
  ipcMain.handle("browser:get-state", (event) => {
    assertTrustedSender(event);
    const contents = browserView?.webContents;

    if (!contents) {
      return null;
    }

    return {
      url: contents.getURL() || START_URL,
      title: contents.getTitle() || "招聘网站",
      isLoading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward()
    };
  });

  ipcMain.handle("browser:navigate", async (event, value) => {
    assertTrustedSender(event);
    const url = normalizeUrl(value);
    await browserView?.webContents.loadURL(url);
    return { ok: true, url };
  });

  ipcMain.handle("browser:back", (event) => {
    assertTrustedSender(event);
    const contents = browserView?.webContents;

    if (contents?.navigationHistory.canGoBack()) {
      contents.navigationHistory.goBack();
    }
  });

  ipcMain.handle("browser:forward", (event) => {
    assertTrustedSender(event);
    const contents = browserView?.webContents;

    if (contents?.navigationHistory.canGoForward()) {
      contents.navigationHistory.goForward();
    }
  });

  ipcMain.handle("browser:reload", (event) => {
    assertTrustedSender(event);
    browserView?.webContents.reload();
  });

  ipcMain.handle("browser:capture", async (event) => {
    assertTrustedSender(event);
    return captureCurrentPage();
  });

  ipcMain.handle("browser:set-bounds", (event, value) => {
    assertTrustedSender(event);
    const nextBounds = sanitizeBounds(value);

    if (!nextBounds || !browserView || !mainWindow) {
      return;
    }

    const { width, height } = mainWindow.getContentBounds();
    browserBounds = {
      x: Math.min(nextBounds.x, width),
      y: Math.min(nextBounds.y, height),
      width: Math.min(nextBounds.width, Math.max(0, width - nextBounds.x)),
      height: Math.min(nextBounds.height, Math.max(0, height - nextBounds.y))
    };

    browserView.setBounds(browserBounds);
  });
}

function scheduleSmokeTest() {
  if (process.env.JOBLOOP_SMOKE_TEST !== "1" || !mainWindow) {
    return;
  }

  setTimeout(async () => {
    try {
      const result = await mainWindow?.webContents.executeJavaScript(
        "window.jobloop.browser.capture()"
      );

      console.log(
        "JOBLOOP_SMOKE_CAPTURE",
        JSON.stringify({
          title: result?.title,
          url: result?.url,
          characterCount: result?.characterCount,
          hasText: Boolean(result?.text)
        })
      );
    } catch (error) {
      console.error("JOBLOOP_SMOKE_ERROR", error);
      process.exitCode = 1;
    } finally {
      app.quit();
    }
  }, 5000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f4f1e9",
    title: "JobLoop - D1 Feasibility",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    browserView = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.once("did-finish-load", () => {
    sendNavigationState();
    scheduleSmokeTest();
  });

  createBrowserView();
}

app.whenReady().then(() => {
  registerIpc();
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
