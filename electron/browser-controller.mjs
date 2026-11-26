import { session, shell, WebContentsView } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AppError,
  ErrorCodes,
  normalizeUrl,
  sanitizeBounds
} from "./validation.mjs";
import { sanitizePageText } from "./page-sanitizer.mjs";
import {
  extractBossJob,
  isBossJobUrl
} from "./adapters/boss-adapter.mjs";

const PAGE_CAPTURE_SCRIPT = `(() => {
  const sanitizePageText = ${sanitizePageText.toString()};
  const rawText = document.body?.innerText ?? "";
  const sanitizedPage = sanitizePageText(rawText);

  const metaDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ??
    document.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
    "";
  const sanitizedDescription = sanitizePageText(metaDescription);
  const sanitizedTitle = sanitizePageText(document.title);

  const salaryNode = document.querySelector(".salary");
  const sanitizedSalary = sanitizePageText(salaryNode?.textContent ?? "");
  const salaryObfuscated =
    sanitizedSalary.salaryObfuscated ||
    sanitizedSalary.privateUseCharacterCount > 0 ||
    Boolean(salaryNode?.querySelector(".zp-hide-salary"));
  const salaryText = salaryObfuscated ? "" : sanitizedSalary.text;

  return {
    title: sanitizedTitle.text,
    url: window.location.href,
    description: sanitizedDescription.text,
    text: sanitizedPage.text.slice(0, 50000),
    characterCount: sanitizedPage.text.length,
    privateUseCharacterCount: sanitizedPage.privateUseCharacterCount,
    salaryText: salaryText.slice(0, 200),
    salaryObfuscated,
    capturedAt: new Date().toISOString()
  };
})()`;

const JOB_PAGE_HTML_SCRIPT = `(() => {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll(
    "script,style,link,noscript,iframe,object,embed,template"
  ).forEach((element) => element.remove());
  return clone.outerHTML;
})()`;

const DEBUG_SNAPSHOT_SCRIPT = `(() => {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll(
    "script,style,link,noscript,iframe,object,embed,template,input,textarea,select,[contenteditable='true']"
  ).forEach((element) => element.remove());

  const allowedAttributes = new Set([
    "class",
    "id",
    "href",
    "src",
    "title",
    "role",
    "aria-selected",
    "aria-label",
    "data-jobid",
    "data-job-id"
  ]);

  for (const element of clone.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (!allowedAttributes.has(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const element of clone.querySelectorAll("[href]")) {
    try {
      const url = new URL(element.getAttribute("href"), location.href);
      element.setAttribute("href", url.pathname + url.hash);
    } catch {
      element.removeAttribute("href");
    }
  }

  for (const element of clone.querySelectorAll("[src]")) {
    try {
      const url = new URL(element.getAttribute("src"), location.href);
      element.setAttribute("src", url.pathname);
    } catch {
      element.removeAttribute("src");
    }
  }

  return clone.outerHTML;
})()`;

export class BrowserController {
  constructor({ mainWindow, partition, startUrl, onNavigationState }) {
    this.mainWindow = mainWindow;
    this.partition = partition;
    this.startUrl = startUrl;
    this.onNavigationState = onNavigationState;
    this.view = null;
    this.bounds = { x: 0, y: 0, width: 1, height: 1 };
  }

  create() {
    const recruitmentSession = session.fromPartition(this.partition);

    recruitmentSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => {
        callback(false);
      }
    );

    this.view = new WebContentsView({
      webPreferences: {
        session: recruitmentSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });

    this.view.setBackgroundColor("#f4f1e9");
    this.mainWindow.contentView.addChildView(this.view);
    this.view.setBounds(this.bounds);

    const contents = this.view.webContents;

    contents.on("did-start-loading", () => {
      this.emitNavigationState({ isLoading: true });
    });
    contents.on("did-stop-loading", () => {
      this.emitNavigationState({ isLoading: false });
    });
    contents.on("did-navigate", () => this.emitNavigationState());
    contents.on("did-navigate-in-page", () => this.emitNavigationState());
    contents.on("page-title-updated", () => this.emitNavigationState());
    contents.on(
      "did-fail-load",
      (_event, code, description, validatedUrl) => {
        if (code === -3) {
          return;
        }

        this.emitNavigationState({
          isLoading: false,
          title: "页面加载失败",
          error: `${description} (${code})`,
          url: validatedUrl || contents.getURL()
        });
      }
    );

    contents.setWindowOpenHandler(({ url }) => {
      try {
        normalizeUrl(url);
        void contents.loadURL(url).catch(() => {
          this.emitNavigationState({
            isLoading: false,
            title: "页面加载失败",
            error: "无法在内嵌浏览器中打开该链接。",
            url
          });
        });

        return { action: "deny" };
      } catch {
        if (url.startsWith("mailto:")) {
          void shell.openExternal(url);
        }
      }

      return { action: "deny" };
    });

    void contents.loadURL(this.startUrl);
  }

  assertAvailable() {
    if (!this.view || this.view.webContents.isDestroyed()) {
      throw new AppError(
        ErrorCodes.BROWSER_UNAVAILABLE,
        "招聘网站浏览器尚未初始化。"
      );
    }

    return this.view.webContents;
  }

  getState() {
    const contents = this.assertAvailable();

    return {
      url: contents.getURL() || this.startUrl,
      title: contents.getTitle() || "招聘网站",
      isLoading: contents.isLoading(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward()
    };
  }

  emitNavigationState(overrides = {}) {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return;
    }

    this.onNavigationState({
      ...this.getState(),
      ...overrides
    });
  }

  async navigate(value) {
    const contents = this.assertAvailable();
    const url = normalizeUrl(value);

    try {
      await contents.loadURL(url);
      return { url };
    } catch {
      throw new AppError(
        ErrorCodes.NAVIGATION_FAILED,
        "无法打开该网址，请检查网址或网络连接。"
      );
    }
  }

  goBack() {
    const contents = this.assertAvailable();

    if (contents.navigationHistory.canGoBack()) {
      contents.navigationHistory.goBack();
    }

    return this.getState();
  }

  goForward() {
    const contents = this.assertAvailable();

    if (contents.navigationHistory.canGoForward()) {
      contents.navigationHistory.goForward();
    }

    return this.getState();
  }

  reload() {
    const contents = this.assertAvailable();
    contents.reload();
    return this.getState();
  }

  async capture() {
    const contents = this.assertAvailable();

    if (contents.isLoading()) {
      throw new AppError(
        ErrorCodes.PAGE_BUSY,
        "页面仍在加载，请稍后再试。"
      );
    }

    try {
      const page = await contents.executeJavaScript(PAGE_CAPTURE_SCRIPT, true);
      let job = null;
      let jobError = "";
      const frames = contents.mainFrame.framesInSubtree ?? [
        contents.mainFrame
      ];

      for (const frame of frames) {
        if (!isBossJobUrl(frame.url)) {
          continue;
        }

        try {
          const html = await frame.executeJavaScript(
            JOB_PAGE_HTML_SCRIPT,
            true
          );
          job = extractBossJob({
            html,
            url: frame.url,
            capturedAt: page.capturedAt
          });
          break;
        } catch (error) {
          jobError =
            error instanceof Error ? error.message : String(error);
        }
      }

      return {
        ...page,
        job,
        jobError
      };
    } catch {
      throw new AppError(
        ErrorCodes.CAPTURE_FAILED,
        "当前页面无法读取，可能是网站限制了脚本执行。"
      );
    }
  }

  setBounds(value) {
    const contents = this.assertAvailable();
    const viewport = this.mainWindow.getContentBounds();
    this.bounds = sanitizeBounds(value, viewport);
    this.view.setBounds(this.bounds);

    return {
      ...this.bounds,
      url: contents.getURL()
    };
  }

  async saveDebugSnapshot() {
    const contents = this.assertAvailable();
    const createdAt = new Date();
    const stamp = createdAt.toISOString().replace(/[:.]/g, "-");
    const directory = path.join(process.cwd(), ".tmp", "snapshots", stamp);
    const frames = contents.mainFrame.framesInSubtree ?? [
      contents.mainFrame
    ];
    const files = [];
    const metadata = [];

    await fs.mkdir(directory, { recursive: true });

    for (const [index, frame] of frames.entries()) {
      if (!frame.url.startsWith("http")) {
        continue;
      }

      try {
        const html = await frame.executeJavaScript(
          DEBUG_SNAPSHOT_SCRIPT,
          true
        );
        const file = path.join(
          directory,
          `frame-${String(index).padStart(2, "0")}.html`
        );
        await fs.writeFile(file, html, "utf8");
        files.push(file);
        metadata.push({
          frameUrl: frame.url,
          file: path.basename(file),
          bytes: Buffer.byteLength(html)
        });
      } catch (error) {
        metadata.push({
          frameUrl: frame.url,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    await fs.writeFile(
      path.join(directory, "metadata.json"),
      JSON.stringify(
        {
          capturedAt: createdAt.toISOString(),
          pageUrl: contents.getURL(),
          pageTitle: contents.getTitle(),
          frames: metadata
        },
        null,
        2
      ),
      "utf8"
    );

    return { directory, files };
  }

  dispose() {
    if (!this.view) {
      return;
    }

    const view = this.view;
    this.view = null;

    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.contentView.removeChildView(view);
    }

    if (!view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  }
}
