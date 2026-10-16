/**
 * Arcade cabinet flavour: power-on BIOS self test -> test pattern -> warning -> VALOFE logo,
 * plus the attract-mode "DEMO PLAY" banner. Pure DOM on its own layer over #app, so it
 * never touches the game canvas or the menu overlay.
 *
 * Skipping: any key / tap fast-forwards the BIOS (it still waits for the real asset load,
 * shown as the PROGRAM ROM check), and a second press cuts the logo short.
 */

const LOGO_SRC = 'assets/ui/valofe-logo.png';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function layer() {
  let el = document.getElementById('arcade-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'arcade-layer';
    el.setAttribute('aria-hidden', 'true');
    (document.getElementById('app') || document.body).appendChild(el);
  }
  return el;
}

function clearLayer() {
  const el = document.getElementById('arcade-layer');
  if (el) el.remove();
}

/** Resolves on the next key / tap / click (used to skip a phase). */
function makeSkipper() {
  let fired = false;
  let wake = null;
  const on = (e) => {
    if (e.type === 'keydown' && (e.repeat || e.code === 'F12')) return;
    fired = true;
    const w = wake;
    wake = null;
    w?.();
  };
  window.addEventListener('keydown', on, true);
  window.addEventListener('pointerdown', on, true);
  return {
    get fired() { return fired; },
    reset() { fired = false; },
    /** Wait ms, or less if the player presses something. */
    wait(ms) {
      if (fired) return Promise.resolve();
      return new Promise((r) => {
        const id = setTimeout(() => { wake = null; r(); }, ms);
        wake = () => { clearTimeout(id); r(); };
      });
    },
    dispose() {
      window.removeEventListener('keydown', on, true);
      window.removeEventListener('pointerdown', on, true);
    },
  };
}

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
const dots = (label, width = 22) => `${label} ${'.'.repeat(Math.max(2, width - label.length))}`;

/**
 * Power-on sequence. `assetsReady` is the boot asset promise; `onProgressHook(fn)` lets the
 * caller forward its loader's {ratio} updates into the PROGRAM ROM bar.
 * @param {{ assetsReady: Promise<any>, onProgressHook: (fn:(p:{ratio:number})=>void)=>void }} opts
 */
export async function playBiosBoot({ assetsReady, onProgressHook }) {
  const root = layer();
  root.className = 'arc-bios';
  root.innerHTML = `
    <div class="arc-crt-on"></div>
    <pre class="arc-bios-text"></pre>
    <div class="arc-scan"></div>`;
  const pre = root.querySelector('.arc-bios-text');
  const skip = makeSkipper();
  let ready = false;
  let ratio = 0;
  assetsReady.then(() => { ready = true; ratio = 1; }, () => { ready = true; });
  onProgressHook?.((p) => { ratio = Math.max(ratio, Math.min(1, Number(p?.ratio) || 0)); });

  const lines = [];
  const paint = () => { pre.innerHTML = lines.join('\n'); };
  const push = async (html, ms = 120) => { lines.push(html); paint(); await skip.wait(ms); };
  const ok = '<b class="ok">OK</b>';

  try {
    await skip.wait(380); // CRT warm-up line
    root.classList.add('is-on');
    await push('<span class="hd">LAO-ARCADE SYSTEM BIOS  Ver.2.6.1012</span>', 160);
    await push('<span class="dim">COPYRIGHT (C) VALOFE CO., LTD.  ALL RIGHTS RESERVED</span>', 260);
    await push('', 60);
    await push(`${dots('MAIN CPU   68K-COMPAT 16MHz')} ${ok}`, 140);
    await push(`${dots('SUB CPU    Z80-COMPAT  8MHz')} ${ok}`, 140);

    // RAM counter ticks up like a real memory test.
    lines.push('');
    for (let kb = 0; kb <= 256; kb += 16) {
      lines[lines.length - 1] = `${dots('WORK RAM')} ${pad(String(kb), 3)} KB`;
      paint();
      await skip.wait(22);
    }
    lines[lines.length - 1] = `${dots('WORK RAM')} 256 KB ${ok}`;
    paint();
    await push(`${dots('VIDEO RAM')} 128 KB ${ok}`, 140);
    await push(`${dots('PALETTE RAM')}   8 KB ${ok}`, 120);
    await push(`${dots('SOUND ROM')} PCM 16CH ${ok}`, 140);
    await push(`${dots('INPUT  P1 / P2 / COIN')} ${ok}`, 160);

    // PROGRAM ROM = the real boot asset load.
    lines.push('');
    const t0 = performance.now();
    for (;;) {
      const shown = ready ? 1 : Math.min(0.99, ratio);
      const n = Math.round(shown * 20);
      lines[lines.length - 1] = `${dots('PROGRAM ROM CHECK')} [${'#'.repeat(n)}${'-'.repeat(20 - n)}] ${pad(String(Math.round(shown * 100)), 3)}%`;
      paint();
      if (ready && performance.now() - t0 > (skip.fired ? 0 : 520)) break;
      await sleep(50);
    }
    lines[lines.length - 1] = `${dots('PROGRAM ROM CHECK')} [${'#'.repeat(20)}] 100% ${ok}`;
    paint();
    await push('', 80);
    await push('<span class="hd blink">ALL SYSTEM CHECKS PASSED</span>', 620);

    // Test pattern: colour bars + crosshatch, the cabinet's monitor check.
    if (!skip.fired) {
      root.innerHTML = '<div class="arc-bars"></div><div class="arc-hatch"></div><div class="arc-scan"></div>';
      await skip.wait(820);
    }

    // Warning card.
    if (!skip.fired) {
      root.className = 'arc-bios is-on';
      root.innerHTML = `
        <div class="arc-warn">
          <h2>WARNING</h2>
          <p>THIS GAME IS PRESENTED BY VALOFE AND MADE BY DEVELOPER B.<br>IF YOU HAD FUN, PLEASE SHARE IT ON X.</p>
          <p class="ko">이 게임은 밸로프에서 제공하고, 개발자B가 제작하였습니다.<br>재미있으면 X에 올려주세요.</p>
        </div>
        <div class="arc-scan"></div>`;
      await skip.wait(1900);
    }
  } finally {
    skip.dispose();
  }
  await assetsReady.catch(() => {});
  const logoSkipped = await playLogo({ short: skip.fired });
  // A press during the boot / logo means "let me play": caller goes straight to the title.
  return skip.fired || logoSkipped;
}

/** VALOFE logo card (also used between demo and title, like an arcade attract loop). */
export async function playLogo({ short = false } = {}) {
  const root = layer();
  root.className = 'arc-logo';
  root.innerHTML = `
    <div class="arc-logo-box">
      <img src="${LOGO_SRC}" alt="VALOFE" draggable="false" />
      <i class="arc-logo-shine"></i>
    </div>
    <div class="arc-scan"></div>`;
  const skip = makeSkipper();
  try {
    await sleep(30);
    root.classList.add('is-in');
    await skip.wait(short ? 700 : 2100);
    root.classList.remove('is-in');
    root.classList.add('is-out');
    await sleep(short || skip.fired ? 260 : 620);
    return skip.fired;
  } finally {
    skip.dispose();
    clearLayer();
  }
}

/** DEMO PLAY banner + blinking prompt over the attract-mode run. */
export function showDemoBanner(text = 'PRESS ANY BUTTON') {
  const root = layer();
  root.className = 'arc-demo';
  // Analog cabinet monitor over the demo run (same scanlines as the logo card, plus grain,
  // a slow rolling bar and flicker); the field itself gets a CRT grade via #app.is-demo-crt.
  root.innerHTML = `
    <div class="arc-grain"></div>
    <div class="arc-roll"></div>
    <div class="arc-scan arc-scan-demo"></div>
    <div class="arc-demo-tag">DEMO PLAY</div>
    <div class="arc-demo-prompt blink">${text}</div>`;
  document.getElementById('app')?.classList.add('is-demo-crt');
  return () => {
    document.getElementById('app')?.classList.remove('is-demo-crt');
    clearLayer();
  };
}

/**
 * CRT power-off between attract and title: the picture squeezes to a bright line, the line
 * shrinks to a dot and the tube goes black (then the caller swaps screens under the black).
 */
export async function crtOff(ms = 720) {
  const app = document.getElementById('app') || document.body;
  const c = document.createElement('div');
  c.id = 'arcade-crt';
  c.setAttribute('aria-hidden', 'true');
  c.style.setProperty('--crt-ms', `${ms}ms`);
  c.innerHTML = '<i class="crt-top"></i><i class="crt-bot"></i><i class="crt-line"></i>';
  app.appendChild(c);
  await sleep(ms + 30);
  blackNow();
  c.remove();
}

/**
 * Tube warm-up into the title: black lifts slowly while a scanline veil and a soft glow
 * settle out, like a cabinet monitor coming back from the attract loop.
 */
export async function crtOn(ms = 900) {
  const app = document.getElementById('app') || document.body;
  const v = document.createElement('div');
  v.id = 'arcade-warm';
  v.setAttribute('aria-hidden', 'true');
  v.style.setProperty('--warm-ms', `${ms + 500}ms`);
  v.innerHTML = '<div class="arc-scan"></div>';
  app.appendChild(v);
  await fadeIn(ms);
  await sleep(520);
  v.remove();
}

/** Plain black cabinet screen (demo sortie loading behind it). */
export function showBlank() {
  const root = layer();
  root.className = 'arc-blank';
  root.innerHTML = '<div class="arc-scan"></div>';
  return () => clearLayer();
}

/**
 * Full-screen black fade over everything (game, menus, arcade layer).
 * fadeOut: transparent -> black. fadeIn: black -> transparent (then removed).
 */
function fadeEl() {
  let el = document.getElementById('arcade-fade');
  if (!el) {
    el = document.createElement('div');
    el.id = 'arcade-fade';
    el.setAttribute('aria-hidden', 'true');
    (document.getElementById('app') || document.body).appendChild(el);
  }
  return el;
}

export async function fadeOut(ms = 450) {
  const el = fadeEl();
  el.style.transition = 'none';
  el.style.opacity = '0';
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '1';
  await sleep(ms + 20);
}

/** Snap to black (no animation) - e.g. before swapping what is underneath. */
export function blackNow() {
  const el = fadeEl();
  el.style.transition = 'none';
  el.style.opacity = '1';
}

export async function fadeIn(ms = 550) {
  const el = fadeEl();
  if (el.style.opacity !== '1') blackNow();
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '0';
  await sleep(ms + 20);
  if (el.style.opacity === '0') el.remove();
}
