const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jobloop", {
  browser: {
    getState: () => ipcRenderer.invoke("browser:get-state"),
    navigate: (url) => ipcRenderer.invoke("browser:navigate", url),
    goBack: () => ipcRenderer.invoke("browser:back"),
    goForward: () => ipcRenderer.invoke("browser:forward"),
    reload: () => ipcRenderer.invoke("browser:reload"),
    capture: () => ipcRenderer.invoke("browser:capture"),
    setBounds: (bounds) => ipcRenderer.invoke("browser:set-bounds", bounds),
    onNavigationState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("browser:navigation-state", listener);

      return () => {
        ipcRenderer.removeListener("browser:navigation-state", listener);
      };
    }
  }
});
