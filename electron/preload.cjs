const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tiny', {
  api: {
    call: (channel, args) => ipcRenderer.invoke(channel, args),
    on: (channel, listener) => {
      const handler = (_event, data) => listener(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  dialog: {
    alert: (title, message) => ipcRenderer.invoke('dialog:alert', { title, message }),
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
  },
});
