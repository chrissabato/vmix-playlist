const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  unwatchDirectory: (dirPath) => ipcRenderer.send('unwatch-directory', dirPath),
  selectItem: (data) => ipcRenderer.invoke('select-item', data),
  selectItems: (data) => ipcRenderer.invoke('select-items', data),
  onDirectoryChanged: (callback) => {
    ipcRenderer.on('directory-changed', (event, data) => callback(data));
  }
});
