import { session, shell, WebContentsView } from "electron";
import {
  AppError,
  ErrorCodes,
  normalizeUrl,
  sanitizeBounds
} from "./validation.mjs";
import { sanitizePageText } from "./page-sanitizer.mjs";

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
      return await contents.executeJavaScript(PAGE_CAPTURE_SCRIPT, true);
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
