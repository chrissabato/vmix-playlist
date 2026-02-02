const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');

const VMIX_HOST = '127.0.0.1';
const VMIX_PORT = 8088;

const watchers = new Map();

function readDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(f => {
      const full = path.join(dirPath, f);
      return fs.statSync(full).isFile();
    })
    .sort()
    .map(f => path.join(dirPath, f));
}

function callVmixApi(params, host, port) {
  const query = new URLSearchParams(params).toString();
  const urlPath = `/api/?${query}`;
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: host || VMIX_HOST, port: port || VMIX_PORT, path: urlPath }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', err => reject(err));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('vMix API timeout')); });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  win.on('closed', () => {
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  });
}

function watchDirectory(dirPath, sender) {
  if (watchers.has(dirPath)) return;

  let debounceTimer = null;
  const watcher = fs.watch(dirPath, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try {
        const items = readDirectory(dirPath);
        sender.send('directory-changed', { dirPath, items });
      } catch (err) {
        // directory may have been deleted
      }
    }, 300);
  });

  watchers.set(dirPath, watcher);
}

ipcMain.handle('pick-directory', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const dirPath = result.filePaths[0];
  const name = path.basename(dirPath);
  const items = readDirectory(dirPath);
  watchDirectory(dirPath, event.sender);
  return { name, dirPath, items };
});

ipcMain.on('unwatch-directory', (event, dirPath) => {
  const watcher = watchers.get(dirPath);
  if (watcher) {
    watcher.close();
    watchers.delete(dirPath);
  }
});

ipcMain.handle('select-item', async (event, { list, item, vmixHost, vmixPort, replace }) => {
  if (!list || !item) {
    return { ok: false, error: 'Missing list or item' };
  }

  const inputName = list;
  const host = vmixHost || VMIX_HOST;
  const port = vmixPort ? parseInt(vmixPort, 10) : VMIX_PORT;

  try {
    if (replace) {
      await callVmixApi({ Function: 'SelectIndex', Input: inputName, Value: '0' }, host, port);
      await callVmixApi({ Function: 'ListRemoveAll', Input: inputName }, host, port);
    }
    await callVmixApi({ Function: 'ListAdd', Input: inputName, Value: item }, host, port);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'vMix API error: ' + err.message };
  }
});

ipcMain.handle('select-items', async (event, { list, items, vmixHost, vmixPort, replace }) => {
  if (!list || !items || items.length === 0) {
    return { ok: false, error: 'Missing list or items' };
  }

  const inputName = list;
  const host = vmixHost || VMIX_HOST;
  const port = vmixPort ? parseInt(vmixPort, 10) : VMIX_PORT;

  try {
    if (replace) {
      await callVmixApi({ Function: 'SelectIndex', Input: inputName, Value: '0' }, host, port);
      await callVmixApi({ Function: 'ListRemoveAll', Input: inputName }, host, port);
    }
    for (const item of items) {
      await callVmixApi({ Function: 'ListAdd', Input: inputName, Value: item }, host, port);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'vMix API error: ' + err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
