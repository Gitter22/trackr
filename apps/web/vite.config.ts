import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Without Docker, this proxy plays Nginx's role: it derives X-Tenant-Slug from
// the Host header (overwriting anything the browser sent) and adds the proxy secret.
const rootEnv = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);
const APP_DOMAIN = process.env.APP_DOMAIN ?? 'localhost';
const API = `http://localhost:${process.env.API_PORT ?? 4000}`;

export function slugFromHost(host: string | undefined, domain: string): string {
  const hostname = (host ?? '').split(':')[0].toLowerCase();
  if (!hostname.endsWith(`.${domain}`)) return '';
  const sub = hostname.slice(0, -(domain.length + 1));
  return /^[a-z0-9-]+$/.test(sub) && sub !== 'admin' ? sub : '';
}

const proxy: ProxyOptions = {
  target: API,
  changeOrigin: false,
  configure: (p) => {
    p.on('proxyReq', (proxyReq, req) => {
      proxyReq.setHeader('X-Tenant-Slug', slugFromHost(req.headers.host, APP_DOMAIN));
      proxyReq.setHeader('X-Proxy-Secret', process.env.PROXY_SECRET ?? '');
    });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { 'import.meta.env.VITE_APP_DOMAIN': JSON.stringify(APP_DOMAIN) },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    host: true,
    allowedHosts: [APP_DOMAIN, `.${APP_DOMAIN}`],
    proxy: { '/api': proxy, '/graphql': proxy },
  },
});
