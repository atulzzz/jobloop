/// <reference types="vite/client" />

type NavigationState = {
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string;
};

type IpcSuccess<T> = {
  ok: true;
  data: T;
};

type IpcFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

type IpcResult<T> = IpcSuccess<T> | IpcFailure;

type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AppInfo = {
  appVersion: string;
  electronVersion: string;
  platform: string;
  sessionPartition: string;
  ipcProtocolVersion: number;
};

type CapturedPage = {
  title: string;
  url: string;
  description: string;
  text: string;
  characterCount: number;
  capturedAt: string;
};

interface Window {
  jobloop: {
    app: {
      getInfo: () => Promise<IpcResult<AppInfo>>;
    };
    browser: {
      getState: () => Promise<IpcResult<NavigationState>>;
      navigate: (url: string) => Promise<IpcResult<{ url: string }>>;
      goBack: () => Promise<IpcResult<NavigationState>>;
      goForward: () => Promise<IpcResult<NavigationState>>;
      reload: () => Promise<IpcResult<NavigationState>>;
      capture: () => Promise<IpcResult<CapturedPage>>;
      setBounds: (
        bounds: BrowserBounds
      ) => Promise<IpcResult<BrowserBounds & { url: string }>>;
      onNavigationState: (
        callback: (state: NavigationState) => void
      ) => () => void;
    };
  };
}
