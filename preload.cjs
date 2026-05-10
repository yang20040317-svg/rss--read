const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给前端
contextBridge.exposeInMainWorld('electronAPI', {
  // 可以在这里添加自定义接口，例如：
  // send: (channel, data) => ipcRenderer.send(channel, data),
  // on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
  platform: process.platform,
  version: process.versions.electron
});

console.log('Gemini RSS Preload Loaded');
