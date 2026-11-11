// Build without Vite (not installable offline here): esbuild bundle -> dist/ (multi-file PWA) + dist/kioku.html (single file).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const NM = process.env.NM || '/opt/npm-tools/node_modules';
const esbuild = require(`${NM}/esbuild`);

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
const res = await esbuild.build({
  entryPoints: ['src/main.tsx'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, outdir: 'dist',
  jsx: 'automatic', nodePaths: [NM], loader: { '.json': 'json' }, define: { 'process.env.NODE_ENV': '"production"' },
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = res.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
const head = (extra = '') => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kioku"><meta name="theme-color" content="#f5f1e8">${extra}
<title>Kioku</title>`;
const body = '<div id="root"></div>';

// single file (artifact / email / AirDrop)
fs.writeFileSync('dist/kioku.html', `${head()}<style>${css}</style></head><body>${body}<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);

// multi-file PWA (for hosting)
fs.writeFileSync('dist/app.js', js);
fs.writeFileSync('dist/app.css', css);
fs.writeFileSync('dist/index.html', `${head('<meta name="kioku-sw" content="1"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon.svg">')}<link rel="stylesheet" href="app.css"></head><body>${body}<script src="app.js"></script></body></html>`);
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({ name: 'Kioku', short_name: 'Kioku', start_url: '.', display: 'standalone', background_color: '#f5f1e8', theme_color: '#f5f1e8', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }] }));
fs.writeFileSync('dist/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#4a8a35"/><text x="50" y="68" font-size="56" text-anchor="middle" fill="#fff" font-family="sans-serif">記</text></svg>`);
fs.writeFileSync('dist/sw.js', `const C='kioku-v1',F=['./','index.html','app.js','app.css','manifest.webmanifest','icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`);
console.log('built', Object.fromEntries(fs.readdirSync('dist').map((f) => [f, fs.statSync('dist/' + f).size])));
