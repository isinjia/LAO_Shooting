/**
 * Tick168 — rotate viewport-grounded recheck (reject #app-letterbox false HARD).
 * Matches tick160/155 criteria: strong/p vs window.innerHeight.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

const ROTATE = [
  ['ko', '화면을 가로로 돌려주세요', '이 게임은 가로 모드에 최적화되어 있습니다.'],
  ['en', 'Please rotate your device', 'This game is best played in landscape.'],
  ['ru', 'Поверните устройство', 'Игра оптимизирована для альбомной ориентации.'],
  ['pt', 'Gire o dispositivo', 'Este jogo funciona melhor no modo paisagem.'],
  ['es', 'Gira el dispositivo', 'Este juego funciona mejor en horizontal.'],
  ['zh-Hant', '請將裝置橫放', '本遊戲適合橫向遊玩。'],
  ['ja', '端末を横にしてください', 'このゲームは横画面向けです。'],
];
const SIZES = [
  { width: 360, height: 640 },
  { width: 400, height: 700 },
  { width: 320, height: 568 },
  { width: 240, height: 320 },
];

const lines = [];
const log = (...a) => {
  const s = a.join(' ');
  lines.push(s);
  console.log(s);
};

const { server, url } = await startServer();
const browser = await chromium.launch({ headless: true });
let hard = 0;
let soft = 0;
let ok = 0;

try {
  for (const size of SIZES) {
    for (const [loc, title, body] of ROTATE) {
      const page = await browser.newPage({ viewport: size });
      try {
        await page.goto(`${url}?cb=t168rt-${loc}-${size.width}x${size.height}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await page.waitForSelector('#btn-start', { timeout: 60000 });
        const m = await page.evaluate(
          ({ title, body }) => {
            document.body.classList.add('touch-ui', 'lao-newui');
            const hint = document.getElementById('rotate-hint');
            hint.classList.add('is-on');
            const strong = hint.querySelector('strong');
            const p = hint.querySelector('p');
            if (strong) strong.textContent = title;
            if (p) p.textContent = body;
            void hint.offsetHeight;
            const vv = {
              top: 0,
              left: 0,
              bottom: window.innerHeight,
              right: window.innerWidth,
              height: window.innerHeight,
              width: window.innerWidth,
            };
            const card = hint.querySelector('.rotate-card');
            const cardR = card.getBoundingClientRect();
            const appR = document.getElementById('app').getBoundingClientRect();
            const panelOverVv = Math.max(0, cardR.bottom - vv.bottom, vv.top - cardR.top);
            const panelOverApp = Math.max(0, cardR.bottom - appR.bottom, appR.top - cardR.top);
            const vis = (el) => {
              if (!el) return 0;
              const r = el.getBoundingClientRect();
              return Math.max(0, Math.min(r.bottom, vv.bottom) - Math.max(r.top, vv.top));
            };
            const out = (el) => {
              if (!el) return true;
              const r = el.getBoundingClientRect();
              return r.bottom > vv.bottom + 1.5 || r.top < vv.top - 1.5;
            };
            return {
              panelOverVv: +panelOverVv.toFixed(2),
              panelOverApp: +panelOverApp.toFixed(2),
              cardH: +cardR.height.toFixed(2),
              vvH: vv.height,
              strongVis: +vis(strong).toFixed(2),
              strongH: strong ? +strong.getBoundingClientRect().height.toFixed(2) : 0,
              pVis: +vis(p).toFixed(2),
              pH: p ? +p.getBoundingClientRect().height.toFixed(2) : 0,
              strongOut: out(strong),
              pOut: out(p),
            };
          },
          { title, body },
        );
        const isHard =
          m.strongOut ||
          m.pOut ||
          m.strongVis < m.strongH - 2 ||
          m.pVis < Math.min(12, m.pH - 2);
        const isSoft = !isHard && m.panelOverVv > 1.5;
        const cls = isHard ? 'HARD' : isSoft ? 'SOFT' : 'ok';
        if (isHard) hard += 1;
        else if (isSoft) soft += 1;
        else ok += 1;
        log(
          `${cls} RT ${loc}@${size.width}x${size.height}`,
          `overVv=${m.panelOverVv} overApp=${m.panelOverApp}`,
          `cardH=${m.cardH}/${m.vvH}`,
          `strong=${m.strongVis}/${m.strongH} p=${m.pVis}/${m.pH}`,
          `strongOut=${m.strongOut} pOut=${m.pOut}`,
        );
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}

log('');
log(`SUMMARY hard=${hard} soft=${soft} ok=${ok}`);
const outPath = join(root, 'tools', 'probe-tick168-rotate-vv.out.txt');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log(`wrote ${outPath}`);
process.exit(hard ? 2 : 0);
