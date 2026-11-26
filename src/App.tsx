import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";
import JobConfirmationForm, {
  createJobDraft,
  type JobDraft
} from "./components/JobConfirmationForm";
import { validateJobConfirmation } from "../shared/job-confirmation.mjs";

const EMPTY_STATE: NavigationState = {
  url: "https://www.zhipin.com/",
  title: "招聘网站",
  isLoading: true,
  canGoBack: false,
  canGoForward: false
};

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

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
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const [confirmedJob, setConfirmedJob] = useState<JobPosting | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const browserSlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = window.jobloop.browser.onNavigationState((state) => {
      setNavigation(state);
      setAddress(state.url || "");
    });

    void Promise.all([
      window.jobloop.app.getInfo(),
      window.jobloop.browser.getState()
    ]).then(([infoResult, stateResult]) => {
      if (infoResult.ok) {
        setAppInfo(infoResult.data);
      }

      if (stateResult.ok) {
        setNavigation(stateResult.data);
        setAddress(stateResult.data.url);
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
      unwrap(await window.jobloop.browser.navigate(address));
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
      const page = unwrap(await window.jobloop.browser.capture());
      setCapturedPage(page);
      setJobDraft(page.job ? createJobDraft(page.job) : null);
      setJobErrors({});
      setConfirmedJob(null);
      setConfirmationMessage("");
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "页面读取失败。"
      );
    } finally {
      setIsCapturing(false);
    }
  }

  function handleJobDraftChange(field: keyof JobDraft, value: string) {
    setJobDraft((current) =>
      current
        ? {
            ...current,
            [field]: value
          }
        : current
    );
    setConfirmedJob(null);
    setConfirmationMessage("");
  }

  function handleConfirmJob() {
    if (!jobDraft) {
      return;
    }

    try {
      const draftForValidation: JobPosting = {
        ...jobDraft,
        skills: jobDraft.skillsText
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean)
      };
      const result = validateJobConfirmation(draftForValidation, {
        confirmedAt: new Date().toISOString()
      });

      setJobErrors(result.errors);

      if (!result.valid) {
        setConfirmedJob(null);
        setConfirmationMessage("请先修正必填字段。");
        return;
      }

      setJobDraft(createJobDraft(result.job));
      setConfirmedJob(result.job);
      setConfirmationMessage("岗位信息已确认，可以进入后续匹配与投递流程。");
    } catch (error) {
      setConfirmationMessage(
        error instanceof Error ? error.message : "岗位确认失败。"
      );
    }
  }

  async function handleSaveDebugSnapshot() {
    setIsSavingSnapshot(true);
    setSnapshotMessage("");

    try {
      const result = unwrap(
        await window.jobloop.browser.saveDebugSnapshot()
      );
      setSnapshotMessage(
        `已保存 ${result.files.length} 个 frame：${result.directory}`
      );
    } catch (error) {
      setSnapshotMessage(
        error instanceof Error ? error.message : "页面快照保存失败。"
      );
    } finally {
      setIsSavingSnapshot(false);
    }
  }

  async function handleBrowserAction(
    action: () => Promise<IpcResult<NavigationState>>
  ) {
    try {
      const state = unwrap(await action());
      setNavigation(state);
      setAddress(state.url);
      setCaptureError("");
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : "浏览器操作失败。"
      );
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">JL</span>
          <div>
            <strong>JobLoop</strong>
            <span>D4 · Job confirmation</span>
          </div>
        </div>

        <div className="browser-controls">
          <button
            className="icon-button"
            type="button"
            aria-label="后退"
            disabled={!navigation.canGoBack}
            onClick={() =>
              void handleBrowserAction(window.jobloop.browser.goBack)
            }
          >
            ←
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="前进"
            disabled={!navigation.canGoForward}
            onClick={() =>
              void handleBrowserAction(window.jobloop.browser.goForward)
            }
          >
            →
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="刷新"
            onClick={() =>
              void handleBrowserAction(window.jobloop.browser.reload)
            }
          >
            ↻
          </button>

          {appInfo?.debugSnapshotEnabled ? (
            <div className="debug-snapshot">
              <button
                type="button"
                disabled={isSavingSnapshot || navigation.isLoading}
                onClick={() => void handleSaveDebugSnapshot()}
              >
                {isSavingSnapshot ? "保存中…" : "保存页面调试快照"}
              </button>
              {snapshotMessage ? <p>{snapshotMessage}</p> : null}
            </div>
          ) : null}

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
          IPC linked
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
              {capturedPage.salaryObfuscated ? (
                <div className="alert alert-warning">
                  页面使用了防抓取字符或 SVG 渲染数字，当前薪资无法可靠读取。预览中的异常字符已替换，请在内嵌页面中人工确认薪资。
                </div>
              ) : null}

              <div className="capture-meta">
                <div>
                  <span>页面标题</span>
                  <strong>{capturedPage.title || "未识别"}</strong>
                </div>
                <div>
                  <span>岗位薪资</span>
                  <strong>
                    {capturedPage.salaryObfuscated
                      ? "需人工确认"
                      : capturedPage.salaryText || "未识别"}
                  </strong>
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

              {jobDraft ? (
                <>
                  <JobConfirmationForm
                    draft={jobDraft}
                    errors={jobErrors}
                    confirmed={Boolean(confirmedJob)}
                    onChange={handleJobDraftChange}
                    onConfirm={handleConfirmJob}
                  />
                  {confirmationMessage ? (
                    <div
                      className={
                        confirmedJob
                          ? "alert alert-success"
                          : "alert alert-warning"
                      }
                    >
                      {confirmationMessage}
                    </div>
                  ) : null}
                </>
              ) : capturedPage.jobError ? (
                <div className="alert alert-warning">
                  岗位结构化失败：{capturedPage.jobError}
                </div>
              ) : null}

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
            <p className="eyebrow">D2 IPC BOUNDARY</p>
            <ul>
              <li>招聘网站不能访问 Node.js、本地文件或数据库</li>
              <li>登录态保存在独立持久化 Chromium Session</li>
              <li>主界面只能调用有限、语义明确的浏览器 IPC</li>
              <li>当前版本不会点击、填写或发送招聘消息</li>
            </ul>

            <div className="runtime-card">
              <div>
                <span>Electron</span>
                <strong>{appInfo?.electronVersion ?? "连接中"}</strong>
              </div>
              <div>
                <span>IPC protocol</span>
                <strong>
                  {appInfo ? `v${appInfo.ipcProtocolVersion}` : "连接中"}
                </strong>
              </div>
              <div>
                <span>Session</span>
                <strong title={appInfo?.sessionPartition}>
                  {appInfo ? "Persistent" : "连接中"}
                </strong>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
