/// <reference types="vite/client" />

type NavigationState = {
  url: string;
  title: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  error?: string;
};

type BrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
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
    browser: {
      getState: () => Promise<NavigationState | null>;
      navigate: (url: string) => Promise<{ ok: boolean; url: string }>;
      goBack: () => Promise<void>;
      goForward: () => Promise<void>;
      reload: () => Promise<void>;
      capture: () => Promise<CapturedPage>;
      setBounds: (bounds: BrowserBounds) => Promise<void>;
      onNavigationState: (
        callback: (state: NavigationState) => void
      ) => () => void;
    };
  };
}
