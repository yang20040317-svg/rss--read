const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let backendProcess;

/**
 * 等待后端服务就绪
 * 每隔 500ms 轮询一次健康检查接口，最多等待 30 秒
 */
function waitForBackend(maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get('http://127.0.0.1:5000/', (res) => {
        resolve();
      });
      req.on('error', () => {
        if (attempts >= maxRetries) {
          reject(new Error('后端服务启动超时'));
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts >= maxRetries) {
          reject(new Error('后端服务启动超时'));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

function startBackend() {
  if (isDev) {
    console.log('开发模式：假设后端已手动启动在 5000 端口');
    return Promise.resolve();
  }

  const backendPath = path.join(process.resourcesPath, 'backend.exe');
  const logPath = path.join(process.resourcesPath, 'backend.log');
  console.log('正在启动后端服务:', backendPath);

  // 将后端日志写入文件，方便排查问题
  const logStream = fs.openSync(logPath, 'a');

  backendProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    stdio: ['ignore', logStream, logStream],
    windowsHide: true,
    detached: false
  });

  backendProcess.on('error', (err) => {
    console.error('无法启动后端进程:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log('后端进程已退出, code:', code);
  });

  // 等待后端真正就绪
  return waitForBackend();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "双子座 RSS 阅读器",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // [FIX] 拦截所有外部链接，在系统浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // [FIX] 拦截页面内导航（<a> 标签点击等），防止 file:// 页面跳转到 http:// URL
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    console.log('后端服务已就绪，正在加载界面...');
  } catch (err) {
    console.error('后端启动失败:', err.message);
  }
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('正在关闭后端服务...');
    backendProcess.kill();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
