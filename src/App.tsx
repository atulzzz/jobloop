import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";

const EMPTY_STATE: NavigationState = {
  url: "https://www.zhipin.com/",
  title: "招聘网站",
  isLoading: true,
  canGoBack: false,
  canGoForward: false
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function App() {
  const [navigation, setNavigation] = useState<NavigationState>(EMPTY_STATE);
  const [address, setAddress] = useState(EMPTY_STATE.url);
  const [capturedPage, setCapturedPage] = useState<CapturedPage | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const browserSlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = window.jobloop.browser.onNavigationState((state) => {
      setNavigation(state);
      setAddress(state.url || "");
    });

    void window.jobloop.browser.getState().then((state) => {
      if (state) {
        setNavigation(state);
        setAddress(state.url);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const slot = browserSlotRef.current;

    if (!slot) {
      return;
    }

    const syncBounds = () => {
      const bounds = slot.getBoundingClientRect();
      void window.jobloop.browser.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
      });
    };

    syncBounds();

    const observer = new ResizeObserver(syncBounds);
    observer.observe(slot);
    window.addEventListener("resize", syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, []);

  async function handleNavigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await window.jobloop.browser.navigate(address);
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "无法打开该网址。"
      );
    }
  }

  async function handleCapture() {
    setIsCapturing(true);
    setCaptureError("");
    setCapturedPage(null);

    try {
      const page = await window.jobloop.browser.capture();
      setCapturedPage(page);
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "页面读取失败。"
      );
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">JL</span>
          <div>
            <strong>JobLoop</strong>
            <span>D1 Feasibility</span>
          </div>
        </div>

        <div className="browser-controls">
          <button
            className="icon-button"
            type="button"
            aria-label="后退"
            disabled={!navigation.canGoBack}
            onClick={() => void window.jobloop.browser.goBack()}
          >
            ←
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="前进"
            disabled={!navigation.canGoForward}
            onClick={() => void window.jobloop.browser.goForward()}
          >
            →
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="刷新"
            onClick={() => void window.jobloop.browser.reload()}
          >
            ↻
          </button>

          <form className="address-form" onSubmit={handleNavigate}>
            <span
              className={`connection-dot ${
                navigation.isLoading ? "is-loading" : ""
              }`}
              aria-hidden="true"
            />
            <input
              aria-label="网址"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              spellCheck={false}
            />
            <button type="submit">打开</button>
          </form>
        </div>

        <div className="mode-pill">
          <span />
          User-guided browser
        </div>
      </header>

      <main className="workspace">
        <section className="browser-pane" aria-label="招聘网站">
          <div id="browser-slot" ref={browserSlotRef} className="browser-slot">
            <div className="browser-placeholder">
              <span className="placeholder-spinner" />
              <p>正在连接招聘网站…</p>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <div className="inspector-heading">
            <p className="eyebrow">CURRENT PAGE</p>
            <h1>页面探针</h1>
            <p>
              用户负责登录和浏览。只有点击下方按钮时，Agent
              才会读取当前岗位页面。
            </p>
          </div>

          <div className="page-card">
            <div className="page-favicon">{navigation.isLoading ? "…" : "W"}</div>
            <div className="page-meta">
              <strong>{navigation.title || "未命名页面"}</strong>
              <span title={navigation.url}>{navigation.url}</span>
            </div>
          </div>

          {navigation.error ? (
            <p className="inline-error">{navigation.error}</p>
          ) : null}

          <button
            className="primary-action"
            type="button"
            disabled={isCapturing || navigation.isLoading}
            onClick={() => void handleCapture()}
          >
            <span>{isCapturing ? "读取中" : "读取当前页面"}</span>
            <span aria-hidden="true">↗</span>
          </button>

          {captureError ? (
            <div className="alert alert-error">{captureError}</div>
          ) : null}

          {capturedPage ? (
            <div className="capture-result">
              <div className="capture-meta">
                <div>
                  <span>页面标题</span>
                  <strong>{capturedPage.title || "未识别"}</strong>
                </div>
                <div>
                  <span>正文长度</span>
                  <strong>
                    {capturedPage.characterCount.toLocaleString("zh-CN")} 字
                  </strong>
                </div>
                <div>
                  <span>读取时间</span>
                  <strong>{formatTime(capturedPage.capturedAt)}</strong>
                </div>
              </div>

              {capturedPage.description ? (
                <p className="page-description">
                  {capturedPage.description}
                </p>
              ) : null}

              <div className="excerpt-heading">
                <span>可见正文预览</span>
                <span>限于当前页面</span>
              </div>
              <pre>{capturedPage.text.slice(0, 2400)}</pre>
            </div>
          ) : (
            <div className="empty-result">
              <div className="scan-lines" aria-hidden="true" />
              <p>尚未读取页面</p>
              <span>
                先完成登录并进入岗位详情页，然后再运行页面探针。
              </span>
            </div>
          )}

          <section className="boundary-card">
            <p className="eyebrow">D1 SECURITY BOUNDARY</p>
            <ul>
              <li>招聘网站不能访问 Node.js、本地文件或数据库</li>
              <li>登录态保存在独立持久化 Chromium Session</li>
              <li>主界面只能调用有限、语义明确的浏览器 IPC</li>
              <li>当前版本不会点击、填写或发送招聘消息</li>
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
