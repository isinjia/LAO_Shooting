// Opening story crawl (arcade style): after the pilot is picked, the story text rolls up
// from the bottom of the screen. Holding a key or a touch fills a round SKIP gauge at the
// bottom; when it closes, the crawl ends. It also ends by itself once the text has passed.
import { getLocale } from './i18n.js';

const STORY = {
  ko: [
    '밤낮없이 이어지는 오르카 대원들의 침실 습격으로 업무하는데 지장이 생긴 사령관.',
    '당분간 업무를 위해 정조를 지키겠다고 선포한다.',
    '마른하늘에 날벼락처럼 떨어진 섹스 금지령에 좌절하는 오르카 대원들.',
    '대원들의 사기가 엄청나게 저하되자, 참모부는 긴급 회의를 소집한다.',
    '장시간의 회의 결과, 참모들은 사령관의 굳은 의지를 존중하지만, 대원들의 사기 저하 역시 큰 문제라며 해결책을 세운다.',
    '그 해결책이 바로, (게임으로) 사령관을 이겨서 소원권을 따는 것…!',
    '계획에 흥미를 느낀 앱실론이 미니 게임을 하나 뚝딱 만들어 주고, 이 과정에서 오르카호에는 괴담이 돌기 시작한다.',
    "밤 12시에 어떤 게임에 접속해서 나타나는 보스를 처치하면 어떤 소원이든 들어주는 '지니'가 나타난다는 괴소문이...",
  ],
  ja: [
    '昼夜を問わず続くオルカ隊員たちの寝室襲撃で、業務に支障をきたした司令官。',
    'しばらくの間、業務のために貞操を守ると宣言する。',
    '青天の霹靂のごとく下された禁欲令に、打ちひしがれるオルカ隊員たち。',
    '隊員たちの士気が著しく低下すると、参謀部は緊急会議を招集する。',
    '長時間の会議の末、参謀たちは司令官の固い意志を尊重しつつも、隊員の士気低下もまた大問題だとして解決策を打ち出す。',
    'その解決策こそ、（ゲームで）司令官に勝って願い事券を手に入れること…！',
    '計画に興味を持ったイプシロンがミニゲームをさっと作り上げ、その過程でオルカ号にはある怪談が広まり始める。',
    '夜12時にあるゲームに接続し、現れるボスを倒すと、どんな願いでも叶えてくれる「ジーニー」が現れるという怪しい噂が…',
  ],
  en: [
    "Night and day, the Orca crew keep raiding the Commander's bedroom, and the work has started to suffer.",
    'So the Commander makes an announcement: for the time being, for the sake of the job, chastity it is.',
    'A total ban on intimacy, out of a clear blue sky. The Orca crew are devastated.',
    'As morale plummets, the staff office calls an emergency meeting.',
    "After hours of debate, the staff respect the Commander's resolve, but a crew this demoralised is a serious problem too. They come up with a plan.",
    'The plan: beat the Commander (at a game) and win a wish ticket...!',
    'Intrigued, Epsilon throws together a mini game, and a ghost story starts spreading through the Orca.',
    'They say that if you log into a certain game at midnight and defeat the boss who appears, a "Genie" will grant any wish you make...',
  ],
};

/** Crawl speed (CSS px/s) and the hold needed to skip (s). */
const SPEED = 46;
const HOLD = 1.0;

const CSS = `
.intro-crawl { position: fixed; inset: 0; z-index: 60; overflow: hidden; background:
  radial-gradient(ellipse at 50% 120%, #1a1030 0%, #07060d 60%, #000 100%); color: #f3e9d2;
  font-family: var(--font-body, sans-serif); user-select: none; -webkit-user-select: none;
  touch-action: none; cursor: default; opacity: 0; transition: opacity .35s ease; }
.intro-crawl.is-on { opacity: 1; }
.intro-crawl::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px); }
.intro-crawl .ic-fade { position: absolute; left: 0; right: 0; height: 22%; pointer-events: none; z-index: 1; }
.intro-crawl .ic-fade.top { top: 0; background: linear-gradient(#000, transparent); }
.intro-crawl .ic-fade.bot { bottom: 0; background: linear-gradient(transparent, #000); }
.intro-crawl .ic-text { position: absolute; left: 50%; top: 0; width: min(760px, calc(100% - 48px));
  transform: translateX(-50%); text-align: center; will-change: transform; }
.intro-crawl .ic-text p { margin: 0 0 1.5em; font-size: clamp(15px, 2.6vw, 22px); line-height: 1.75;
  letter-spacing: .02em; word-break: keep-all; text-shadow: 0 0 6px rgba(255, 196, 120, .45), 0 2px 0 #000; }
.intro-crawl .ic-text p:last-child { color: #ffd48a; }
.intro-crawl .ic-skip { position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom));
  width: 64px; height: 64px; margin-left: -32px; z-index: 2; opacity: 0; transition: opacity .15s; }
.intro-crawl .ic-skip.is-on { opacity: 1; }
.intro-crawl .ic-skip svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.intro-crawl .ic-skip .ring-bg { fill: rgba(0,0,0,.55); stroke: rgba(255,255,255,.18); stroke-width: 4; }
.intro-crawl .ic-skip .ring { fill: none; stroke: #ffd48a; stroke-width: 4; stroke-linecap: round; }
.intro-crawl .ic-skip span { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #fff; }
.intro-crawl .ic-hint { position: absolute; right: 16px; bottom: max(14px, env(safe-area-inset-bottom));
  z-index: 2; font-size: 12px; color: rgba(255,255,255,.45); letter-spacing: .08em; }
`;

const HINT = { ko: '길게 눌러 SKIP', ja: '長押しでSKIP', en: 'Hold to SKIP' };

/**
 * Play the crawl, then call `done` (once). Returns a cancel function.
 */
export function showIntroCrawl(done) {
  // Automated runs (Playwright eval / probe tools) go straight to the sortie; ?intro=1 forces it.
  if (navigator.webdriver && !/[?&]intro=1/.test(location.search)) {
    done?.();
    return () => {};
  }
  if (!document.getElementById('intro-crawl-css')) {
    const st = document.createElement('style');
    st.id = 'intro-crawl-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lang = getLocale();
  const lines = STORY[lang] || STORY.en;
  const root = document.createElement('div');
  root.className = 'intro-crawl';
  const R = 28;
  const C = 2 * Math.PI * R;
  root.innerHTML = `
    <div class="ic-fade top"></div><div class="ic-fade bot"></div>
    <div class="ic-text">${lines.map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}</div>
    <div class="ic-skip"><svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="${R}"/>
      <circle class="ring" cx="32" cy="32" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>
      <span>SKIP</span></div>
    <div class="ic-hint">${HINT[lang] || HINT.en}</div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('is-on'));
  const text = root.querySelector('.ic-text');
  const skip = root.querySelector('.ic-skip');
  const ring = root.querySelector('.ring');

  let y = root.clientHeight;
  let hold = 0;
  let holding = 0; // pointer / key presses currently down
  let last = performance.now();
  let raf = 0;
  let ended = false;

  const finish = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    root.classList.remove('is-on');
    setTimeout(() => root.remove(), 360);
    done?.();
  };
  const keys = new Set();
  // Capture phase + stopPropagation: keys pressed here never reach the select / title menus.
  const onKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!keys.has(e.code)) { keys.add(e.code); holding += 1; }
  };
  const onKeyUp = (e) => {
    e.stopPropagation();
    if (keys.delete(e.code)) holding = Math.max(0, holding - 1);
  };
  const onDown = (e) => { e.preventDefault(); holding += 1; };
  const onUp = () => { holding = Math.max(0, holding - 1); };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    y -= SPEED * dt;
    text.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
    if (holding > 0) hold = Math.min(HOLD, hold + dt);
    else hold = 0;
    skip.classList.toggle('is-on', hold > 0);
    ring.setAttribute('stroke-dashoffset', String(C * (1 - hold / HOLD)));
    if (hold >= HOLD || y + text.offsetHeight < 0) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return finish;
}
