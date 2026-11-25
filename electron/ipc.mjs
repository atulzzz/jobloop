import {
  AppError,
  ErrorCodes,
  toPublicError
} from "./validation.mjs";

function success(data) {
  return { ok: true, data };
}

function failure(error) {
  return { ok: false, error: toPublicError(error) };
}

export function registerIpc({
  ipcMain,
  channels,
  getMainWindow,
  getBrowserController,
  appInfo
}) {
  const assertTrustedSender = (event) => {
    const mainWindow = getMainWindow();

    if (!mainWindow || event.sender !== mainWindow.webContents) {
      throw new AppError(
        ErrorCodes.UNTRUSTED_SENDER,
        "未授权的主界面请求。"
      );
    }
  };

  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        assertTrustedSender(event);
        return success(await handler(payload));
      } catch (error) {
        return failure(error);
      }
    });
  };

  const getBrowser = () => {
    const browser = getBrowserController();

    if (!browser) {
      throw new AppError(
        ErrorCodes.BROWSER_UNAVAILABLE,
        "招聘网站浏览器尚未初始化。"
      );
    }

    return browser;
  };

  handle(channels.appInfo, () => ({
    ...appInfo(),
    ipcProtocolVersion: 1
  }));
  handle(channels.browserGetState, () => getBrowser().getState());
  handle(channels.browserNavigate, (url) => getBrowser().navigate(url));
  handle(channels.browserBack, () => getBrowser().goBack());
  handle(channels.browserForward, () => getBrowser().goForward());
  handle(channels.browserReload, () => getBrowser().reload());
  handle(channels.browserCapture, () => getBrowser().capture());
  handle(channels.browserSetBounds, (bounds) =>
    getBrowser().setBounds(bounds)
  );
}
