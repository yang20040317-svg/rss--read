import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // 本地代理，解决 CORS 问题
      '/api/proxy': {
        target: 'https://api.allorigins.win',
        changeOrigin: true,
        timeout: 60000, // 60秒超时
        proxyTimeout: 60000,
        rewrite: (path) => path.replace(/^\/api\/proxy/, '/raw'),
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('代理错误:', err);
            // 返回502错误让前端触发备用代理
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 设置请求超时
            proxyReq.setTimeout(60000);
          });
        }
      }
    }
  }
})