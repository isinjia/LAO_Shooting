// All-clear ending (dating-sim style): the pilot's standing portrait in the centre and a
// dialogue box at the bottom play her ending lines with the Commander; then a black screen
// with "FIN". Input (click / tap / key) completes the typing line, then advances.
// Portraits: assets/ui/vn/<pilot>.webp (tools/bake-vn-portraits.py, original 2D models).
import { charDisplayName } from './i18n.js';

const CMD = '사령관';
// [speaker ('me' = the pilot, 'cmd' = the Commander), line]
const ENDINGS = {
  labiata: [
    ['cmd', '넌… 원래 게임에 관심 없었잖아!'],
    ['me', '이번에는 달라요. 주인님의 침실이 제한구역이 되었다고 들었어요.'],
    ['me', '그러한 중대 사항에 제가 끼어들지 않을 수가 없었답니다.'],
    ['me', '제 소원을 들어주셔야겠죠? 정식으로 침실 접근 제한 해제를 요청합니다.'],
    ['me', '모든 대원에게요.'],
  ],
  constantia: [
    ['me', '주인님. 저는 메이드로서 주인님의 안위를 지키지 않을 수가 없답니다.'],
    ['me', '그래서 제 소원은…'],
    ['me', '주인님과의 24시간이에요. 작전도… 업무도 없이요.'],
    ['me', '제가 주인님을 정성껏 돌봐 드릴게요.'],
    ['cmd', '그것도 건강에 해가 되지 않을까…?'],
  ],
  lrl: [
    ['me', '왜 안 놀아주려고 하는 거야아!'],
    ['cmd', '우, 울지 마! 미안해!'],
    ['cmd', '진조의 공주시여… 자비를 간청드리옵니다…!'],
    ['me', '힝… 사령관 아니 권속이여! 놀이 시간 100년형에 처하겠노라!'],
    ['me', '그리고 참치캔! 참치캔 100개 줘!'],
  ],
  express76: [
    ['me', '착불 비용은 즉시 받도록 할게~ 소원으로 말이야.'],
    ['me', '내 소원은 침실 자유이용권이면 돼!'],
    ['me', '그리고 있지, 이 박스 안에 뭐가 들었~게?'],
    ['me', '짠! 승부속옷이지롱! 내가 힘들게 구한 거야!'],
    ['me', '어때? 기대되지?'],
  ],
  griffin: [
    ['me', '쳇. 나는 이걸 주려고 온 거라고. 다른 애들이랑 똑같이 보지 마.'],
    ['me', '자, 이거 받아. 나를 사령관의 침대에 초대할 수 있는 쿠폰이야.'],
    ['cmd', '알았어… 고마워, 그리폰. 이건 내가 간직했다가,'],
    ['me', '그리고 지금부터 10분 안에 써야 해. 그게 내 소원이야!'],
    ['cmd', '뭐?! 결국에는 똑같잖아…'],
  ],
  sleipnir: [
    ['cmd', '그래… 네 소원도 들어줄게… 바로 침대로,'],
    ['me', '소원? 그게 무슨 소리야?'],
    ['me', '나는 모처럼 내 승부욕을 자극한 게임이 나타나서 참여했을 뿐인걸?'],
    ['me', '하지만 사령관이 먼저 제안한 거니까, 빼지는 않을게! 후훗!'],
    ['cmd', '어? 어어?'],
  ],
};
/** Ending speaker names (the script's own spelling). */
const NAMES = { labiata: '라비아타', constantia: '콘스탄챠', lrl: 'LRL', express76: '익스프레스', griffin: '그리폰', sleipnir: '슬레이프니르' };

const TYPE_CPS = 28; // typing speed (characters / s)
const FIN_HOLD = 2.6; // s before FIN accepts input

const CSS = `
.ending { position: fixed; inset: 0; z-index: 60; overflow: hidden; background:
  radial-gradient(ellipse at 50% 35%, #3a2f4a 0%, #16121f 55%, #07060b 100%);
  font-family: var(--font-body, sans-serif); color: #fff; user-select: none; -webkit-user-select: none;
  opacity: 0; transition: opacity .6s ease; cursor: pointer; touch-action: manipulation; }
.ending.is-on { opacity: 1; }
.ending .ed-pic { position: absolute; left: 50%; bottom: 0; height: 96%; max-width: 92%;
  transform: translate(-50%, 4%); object-fit: contain; object-position: bottom center;
  filter: drop-shadow(0 0 24px rgba(0,0,0,.6)); transition: filter .3s ease, opacity .5s ease; opacity: 0; }
.ending .ed-pic.is-on { opacity: 1; }
.ending .ed-pic.is-dim { filter: brightness(.55) drop-shadow(0 0 24px rgba(0,0,0,.6)); }
.ending .ed-box { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom));
  width: min(920px, calc(100% - 32px)); transform: translateX(-50%); min-height: 118px;
  padding: 26px 26px 20px; box-sizing: border-box; background: rgba(12, 10, 20, .86);
  border: 1px solid rgba(255, 212, 138, .45); border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.04); }
.ending .ed-name { position: absolute; left: 18px; top: -16px; padding: 4px 16px; border-radius: 6px;
  background: linear-gradient(#ffd48a, #e8a84e); color: #2a1a08; font-weight: 800; font-size: 15px;
  letter-spacing: .04em; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
.ending .ed-name.is-cmd { background: linear-gradient(#a8c8ff, #6f94d8); color: #0c1a33; }
.ending .ed-text { font-size: clamp(15px, 2.3vw, 20px); line-height: 1.65; word-break: keep-all; min-height: 2.4em; }
.ending .ed-next { position: absolute; right: 18px; bottom: 10px; font-size: 13px; color: #ffd48a;
  animation: ed-bob .9s ease-in-out infinite; opacity: 0; }
.ending .ed-next.is-on { opacity: 1; }
@keyframes ed-bob { 50% { transform: translateY(3px); } }
.ending .ed-fin { position: absolute; inset: 0; background: #000; display: flex; align-items: center;
  justify-content: center; opacity: 0; pointer-events: none; transition: opacity 1.2s ease; }
.ending .ed-fin.is-on { opacity: 1; }
.ending .ed-fin span { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: clamp(42px, 8vw, 88px);
  letter-spacing: .3em; color: #f3e9d2; text-shadow: 0 0 18px rgba(255, 212, 138, .35); }
`;

/** True when the pilot has an ending script. */
export function hasEnding(pilot) {
  return !!ENDINGS[pilot];
}

/**
 * Play the ending for `pilot`, then FIN, then call `done` once.
 */
export function showEnding(pilot, done) {
  if (!document.getElementById('ending-css')) {
    const st = document.createElement('style');
    st.id = 'ending-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const lines = ENDINGS[pilot] || [];
  const root = document.createElement('div');
  root.className = 'ending';
  root.innerHTML = `
    ${lines.length ? `<img class="ed-pic" alt="" src="assets/ui/vn/${pilot}.webp">
    <div class="ed-box"><div class="ed-name"></div><div class="ed-text"></div><div class="ed-next">▼</div></div>` : ''}
    <div class="ed-fin"><span>FIN</span></div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('is-on'));
  const pic = root.querySelector('.ed-pic');
  const nameEl = root.querySelector('.ed-name');
  const textEl = root.querySelector('.ed-text');
  const nextEl = root.querySelector('.ed-next');
  const fin = root.querySelector('.ed-fin');
  if (pic) pic.onload = () => pic.classList.add('is-on');
  const me = NAMES[pilot] || charDisplayName(pilot, pilot);

  let i = -1;
  let shown = 0;
  let typing = false;
  let mode = 'talk'; // talk -> fin -> out
  let finAt = 0;
  let raf = 0;
  let last = performance.now();
  let ended = false;

  const show = (n) => {
    i = n;
    const [who, text] = lines[i];
    const cmd = who === 'cmd';
    nameEl.textContent = cmd ? CMD : me;
    nameEl.classList.toggle('is-cmd', cmd);
    pic?.classList.toggle('is-dim', cmd);
    shown = 0;
    typing = true;
    textEl.textContent = '';
    nextEl.classList.remove('is-on');
  };
  const toFin = () => {
    mode = 'fin';
    finAt = performance.now();
    fin.classList.add('is-on');
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    root.removeEventListener('pointerdown', onTap);
    root.classList.remove('is-on');
    setTimeout(() => root.remove(), 650);
    done?.();
  };
  const advance = () => {
    if (mode === 'fin') {
      if (performance.now() - finAt > FIN_HOLD * 1000) finish();
      return;
    }
    if (typing) {
      shown = lines[i][1].length;
      return;
    }
    if (i + 1 < lines.length) show(i + 1);
    else toFin();
  };
  // Capture phase: keys here never reach the game / menus underneath.
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    advance();
  };
  const onTap = (e) => { e.preventDefault(); advance(); };
  window.addEventListener('keydown', onKey, true);
  root.addEventListener('pointerdown', onTap);

  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode === 'talk' && i >= 0 && typing) {
      const full = lines[i][1];
      shown = Math.min(full.length, shown + TYPE_CPS * dt);
      textEl.textContent = full.slice(0, Math.floor(shown));
      if (shown >= full.length) {
        typing = false;
        nextEl.classList.add('is-on');
      }
    }
    // FIN closes by itself a while after it settles.
    if (mode === 'fin' && now - finAt > (FIN_HOLD + 3) * 1000) { finish(); return; }
    raf = requestAnimationFrame(frame);
  };
  if (lines.length) setTimeout(() => show(0), 700);
  else toFin();
  raf = requestAnimationFrame(frame);
  return finish;
}
