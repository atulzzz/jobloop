const { contextBridge, ipcRenderer } = require("electron");

// Sandboxed preload scripts cannot load arbitrary files. Keep these names
// identical to shared/ipc-channels.json; the IPC contract test checks them.
const channels = Object.freeze({
  appInfo: "app:info",
  browserGetState: "browser:get-state",
  browserNavigate: "browser:navigate",
  browserBack: "browser:back",
  browserForward: "browser:forward",
  browserReload: "browser:reload",
  browserCapture: "browser:capture",
  browserSetBounds: "browser:set-bounds",
  browserNavigationState: "browser:navigation-state"
});

contextBridge.exposeInMainWorld("jobloop", {
  app: {
    getInfo: () => ipcRenderer.invoke(channels.appInfo)
  },
  browser: {
    getState: () => ipcRenderer.invoke(channels.browserGetState),
    navigate: (url) =>
      ipcRenderer.invoke(channels.browserNavigate, url),
    goBack: () => ipcRenderer.invoke(channels.browserBack),
    goForward: () => ipcRenderer.invoke(channels.browserForward),
    reload: () => ipcRenderer.invoke(channels.browserReload),
    capture: () => ipcRenderer.invoke(channels.browserCapture),
    setBounds: (bounds) =>
      ipcRenderer.invoke(channels.browserSetBounds, bounds),
    onNavigationState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on(channels.browserNavigationState, listener);

      return () => {
        ipcRenderer.removeListener(
          channels.browserNavigationState,
          listener
        );
      };
    }
  }
});
