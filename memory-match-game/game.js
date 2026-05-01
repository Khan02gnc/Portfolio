// ─── EMOJI POOL ───────────────────────────────────────────────────────────────
const EMOJIS = [
  '🦊','🐼','🦁','🐸','🦋','🐳','🐙','🦄','🐧','🦀',
  '🐝','🦩','🌈','🍕','🎸','🚀','🎯','💎','🌺','🍉',
  '⚡','🎃','🦜','🎲','🍀','🔥','🌙','👑','🎪','🏆',
  '🌊','🎠','🍄','🦚','🌸','🍦','🐬','🎨','🎡','🦋'
];

// ─── LEVEL DEFINITIONS ────────────────────────────────────────────────────────
// pairs  = number of unique emoji pairs on the board
// cols   = grid columns
// rows   = grid rows
// limit  = max moves before failing
// s3     = move threshold for 3 stars
// s2     = move threshold for 2 stars
const LEVELS = {
  easy: [
    { pairs:  4, cols: 4, rows: 2, limit: 12, s3:  6, s2:  9 },
    { pairs:  5, cols: 5, rows: 2, limit: 14, s3:  7, s2: 11 },
    { pairs:  6, cols: 4, rows: 3, limit: 16, s3:  8, s2: 12 },
    { pairs:  6, cols: 4, rows: 3, limit: 18, s3:  9, s2: 14 },
    { pairs:  7, cols: 7, rows: 2, limit: 20, s3: 10, s2: 15 },
    { pairs:  8, cols: 4, rows: 4, limit: 22, s3: 12, s2: 17 },
    { pairs:  8, cols: 4, rows: 4, limit: 24, s3: 13, s2: 19 },
    { pairs:  9, cols: 6, rows: 3, limit: 26, s3: 14, s2: 20 },
    { pairs: 10, cols: 5, rows: 4, limit: 28, s3: 16, s2: 22 },
    { pairs: 10, cols: 5, rows: 4, limit: 30, s3: 17, s2: 24 },
  ],
  med: [
    { pairs:  8, cols: 4, rows: 4, limit: 20, s3: 12, s2: 16 },
    { pairs:  9, cols: 6, rows: 3, limit: 22, s3: 13, s2: 17 },
    { pairs: 10, cols: 5, rows: 4, limit: 24, s3: 14, s2: 19 },
    { pairs: 10, cols: 5, rows: 4, limit: 26, s3: 15, s2: 21 },
    { pairs: 12, cols: 6, rows: 4, limit: 28, s3: 17, s2: 23 },
    { pairs: 12, cols: 6, rows: 4, limit: 30, s3: 18, s2: 25 },
    { pairs: 14, cols: 7, rows: 4, limit: 34, s3: 20, s2: 27 },
    { pairs: 15, cols: 6, rows: 5, limit: 36, s3: 22, s2: 29 },
    { pairs: 16, cols: 8, rows: 4, limit: 38, s3: 24, s2: 31 },
    { pairs: 18, cols: 6, rows: 6, limit: 42, s3: 26, s2: 34 },
  ],
  hard: [
    { pairs: 10, cols:  5, rows: 4, limit: 22, s3: 14, s2: 18 },
    { pairs: 12, cols:  6, rows: 4, limit: 24, s3: 16, s2: 20 },
    { pairs: 14, cols:  7, rows: 4, limit: 28, s3: 18, s2: 23 },
    { pairs: 15, cols:  6, rows: 5, limit: 30, s3: 20, s2: 25 },
    { pairs: 16, cols:  8, rows: 4, limit: 32, s3: 22, s2: 27 },
    { pairs: 18, cols:  6, rows: 6, limit: 36, s3: 24, s2: 30 },
    { pairs: 20, cols:  8, rows: 5, limit: 40, s3: 26, s2: 33 },
    { pairs: 20, cols:  8, rows: 5, limit: 44, s3: 28, s2: 36 },
    { pairs: 20, cols: 10, rows: 4, limit: 46, s3: 30, s2: 38 },
    { pairs: 20, cols: 10, rows: 4, limit: 50, s3: 32, s2: 42 },
  ]
};

const DIFF_INFO = {
  easy: { label: 'Easy',   cls: 'easy', desc: 'Small grids · Perfect for warming up' },
  med:  { label: 'Medium', cls: 'med',  desc: 'Bigger grids · More pairs to match'   },
  hard: { label: 'Hard',   cls: 'hard', desc: 'Large grids · Limited moves!'         },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let users    = JSON.parse(localStorage.getItem('mm_users2') || '{}');
let curUser  = null;
let curDiff  = 'easy';
let curLvlIdx = 0;
let curCfg   = null;

let cards       = [];
let flipped     = [];
let matchedPairs = 0;
let moves       = 0;
let timerInt    = null;
let secs        = 0;
let locked      = false;

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function saveUsers() {
  localStorage.setItem('mm_users2', JSON.stringify(users));
}

function getProgress() {
  if (!users[curUser].progress) users[curUser].progress = {};
  return users[curUser].progress;
}

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function switchTab(t) {
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (i === 0 && t === 'login') || (i === 1 && t === 'register'))
  );
  document.getElementById('login-form').style.display    = t === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = t === 'register' ? '' : 'none';
  clearMsgs();
}

function clearMsgs() {
  ['lmsg', 'rmsg'].forEach(id => {
    const e = document.getElementById(id);
    e.className = 'amsg';
    e.textContent = '';
  });
}

function showMsg(id, txt, type) {
  const e = document.getElementById(id);
  e.textContent = txt;
  e.className = 'amsg ' + type;
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const showing = inp.type === 'text';
  inp.type = showing ? 'password' : 'text';
  btn.textContent = showing ? '👁' : '🙈';
}

function pwStrength(v) {
  const h = document.getElementById('pwhint');
  if (!v)       { h.textContent = 'Max 6 characters'; h.className = 'hint'; return; }
  if (v.length < 3) { h.textContent = 'Too short';        h.className = 'hint error'; }
  else if (v.length < 5) { h.textContent = 'Getting there...'; h.className = 'hint'; }
  else { h.textContent = v.length + '/6 — good!'; h.className = 'hint ok'; }
}

// ─── AUTH ACTIONS ─────────────────────────────────────────────────────────────
function doLogin() {
  const u = document.getElementById('lu').value.trim();
  const p = document.getElementById('lp').value;
  if (!u || !p)              { showMsg('lmsg', 'Fill in all fields', 'err'); return; }
  if (!users[u] || users[u].password !== p) {
    showMsg('lmsg', 'Invalid username or password', 'err'); return;
  }
  curUser = u;
  showLevelSelect();
}

function doRegister() {
  const u  = document.getElementById('ru').value.trim();
  const p  = document.getElementById('rp').value;
  const p2 = document.getElementById('rp2').value;
  if (!u || !p || !p2)  { showMsg('rmsg', 'Fill in all fields', 'err'); return; }
  if (u.length < 2)     { showMsg('rmsg', 'Username too short', 'err'); return; }
  if (p.length < 1)     { showMsg('rmsg', 'Password required', 'err'); return; }
  if (p.length > 6)     { showMsg('rmsg', 'Password max 6 characters', 'err'); return; }
  if (p !== p2)         { showMsg('rmsg', 'Passwords do not match', 'err'); return; }
  if (users[u])         { showMsg('rmsg', 'Username already taken', 'err'); return; }
  users[u] = { password: p, progress: {} };
  saveUsers();
  showMsg('rmsg', 'Account created! Signing in...', 'ok');
  setTimeout(() => { curUser = u; showLevelSelect(); }, 800);
}

function logout() {
  clearInterval(timerInt);
  curUser = null;
  document.getElementById('game').style.display   = 'none';
  document.getElementById('lvlsel').style.display = 'none';
  document.getElementById('auth').style.display   = 'flex';
  document.getElementById('lu').value = '';
  document.getElementById('lp').value = '';
  clearMsgs();
}

// ─── LEVEL SELECT ─────────────────────────────────────────────────────────────
function showLevelSelect() {
  document.getElementById('auth').style.display   = 'none';
  document.getElementById('game').style.display   = 'none';
  document.getElementById('lvlsel').style.display = 'flex';
  document.getElementById('ls-uname').textContent = '👤 ' + curUser;
  renderLevelGrid(curDiff);
}

function showDiff(d, el) {
  curDiff = d;
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderLevelGrid(d);
}

function renderLevelGrid(d) {
  const info = DIFF_INFO[d];
  document.getElementById('diff-info').innerHTML =
    `<span class="diff-badge ${info.cls}">${info.label}</span>
     <div class="lvl-info">${info.desc}</div>`;

  const grid = document.getElementById('lvl-grid');
  grid.innerHTML = '';
  const prog = getProgress();

  LEVELS[d].forEach((cfg, i) => {
    const key      = d + '_' + i;
    const stars    = prog[key] || 0;
    const unlocked = i === 0 || (prog[d + '_' + (i - 1)] > 0);

    const btn = document.createElement('div');
    btn.className = 'lvl-btn' + (unlocked ? '' : ' locked') + (stars > 0 ? ' done' : '');

    if (unlocked) {
      let starStr = '';
      for (let s = 0; s < 3; s++) starStr += (s < stars ? '★' : '☆');
      btn.innerHTML = `
        <div class="lvl-num">${i + 1}</div>
        <div class="stars" style="color:${stars > 0 ? '#f59e0b' : '#475569'}">${starStr}</div>`;
      btn.onclick = () => startLevel(d, i);
    } else {
      btn.innerHTML = `<div class="lock-ico">🔒</div>`;
    }

    grid.appendChild(btn);
  });
}

// ─── GAME START ───────────────────────────────────────────────────────────────
function startLevel(d, idx) {
  curDiff   = d;
  curLvlIdx = idx;
  curCfg    = LEVELS[d][idx];

  document.getElementById('lvlsel').style.display = 'none';
  document.getElementById('game').style.display   = 'flex';

  const info = DIFF_INFO[d];
  const tag  = document.getElementById('g-diff-tag');
  tag.className   = 'lvl-tag ' + info.cls;
  tag.textContent = info.label;

  document.getElementById('g-lvl-title').textContent =
    `Level ${idx + 1}`;
  document.getElementById('g-star-hint').textContent =
    `★★★ ≤${curCfg.s3} moves  ·  ★★ ≤${curCfg.s2} moves`;

  buildGame();
}

function buildGame() {
  clearInterval(timerInt);
  secs = 0; moves = 0; matchedPairs = 0; flipped = []; locked = false;

  document.getElementById('g-moves').textContent = '0';
  document.getElementById('g-limit').textContent = curCfg.limit;
  document.getElementById('g-pairs').textContent = '0/' + curCfg.pairs;
  document.getElementById('g-time').textContent  = '0s';
  updateProg();

  const chosen = EMOJIS.slice(0, curCfg.pairs);
  let deck = [...chosen, ...chosen];
  deck.sort(() => Math.random() - .5);
  cards = deck;

  renderBoard();

  timerInt = setInterval(() => {
    secs++;
    document.getElementById('g-time').textContent = secs + 's';
  }, 1000);
}

// ─── BOARD RENDER ─────────────────────────────────────────────────────────────
function renderBoard() {
  const board = document.getElementById('board');
  const wrap  = document.querySelector('.board-wrap');
  const cols  = curCfg.cols;
  const maxW  = Math.min(wrap.clientWidth - 32, 560);
  const cardSz = Math.floor((maxW - (cols - 1) * 10) / cols);

  board.style.gridTemplateColumns = `repeat(${cols}, ${cardSz}px)`;
  board.innerHTML = '';

  cards.forEach((emoji, i) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.innerHTML = `
      <div class="card-inner">
        <div class="card-front"></div>
        <div class="card-back"><span class="em">${emoji}</span></div>
      </div>`;
    c.addEventListener('click', () => flipCard(c, i, emoji));
    board.appendChild(c);
  });
}

// ─── CARD FLIP LOGIC ──────────────────────────────────────────────────────────
function flipCard(card, idx, emoji) {
  if (locked || card.classList.contains('flipped') || card.classList.contains('matched')) return;
  card.classList.add('flipped');
  flipped.push({ card, idx, emoji });

  if (flipped.length === 2) {
    moves++;
    document.getElementById('g-moves').textContent = moves;
    locked = true;

    const movesLeft = curCfg.limit - moves;
    if (movesLeft <= 0 && matchedPairs < curCfg.pairs) {
      setTimeout(() => { checkMatchThen(checkFail); }, 700);
    } else {
      setTimeout(checkMatch, 750);
    }
  }
}

function checkMatchThen(cb) {
  const [a, b] = flipped;
  if (a.emoji === b.emoji) {
    a.card.classList.add('matched');
    b.card.classList.add('matched');
    matchedPairs++;
    document.getElementById('g-pairs').textContent = matchedPairs + '/' + curCfg.pairs;
    updateProg();
    if (matchedPairs === curCfg.pairs) {
      clearInterval(timerInt);
      setTimeout(showWin, 400);
      return;
    }
  } else {
    a.card.classList.remove('flipped');
    b.card.classList.remove('flipped');
  }
  flipped = [];
  locked  = false;
  if (cb) cb();
}

function checkMatch() { checkMatchThen(null); }

function checkFail() {
  if (moves >= curCfg.limit && matchedPairs < curCfg.pairs) {
    clearInterval(timerInt);
    document.getElementById('fov-sub').textContent =
      `You used all ${curCfg.limit} moves. ${curCfg.pairs - matchedPairs} pair(s) remaining.`;
    showOv('fail-ov');
  }
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
function updateProg() {
  const pct = Math.round((matchedPairs / curCfg.pairs) * 100);
  document.getElementById('prog-bar').style.width = pct + '%';
  document.getElementById('prog-label').textContent = matchedPairs + ' / ' + curCfg.pairs + ' pairs';
}

// ─── STAR CALC & WIN ──────────────────────────────────────────────────────────
function calcStars() {
  if (moves <= curCfg.s3) return 3;
  if (moves <= curCfg.s2) return 2;
  return 1;
}

function showWin() {
  const s   = calcStars();
  const key = curDiff + '_' + curLvlIdx;
  const prog = getProgress();
  if (!prog[key] || s > prog[key]) {
    prog[key] = s;
    users[curUser].progress = prog;
    saveUsers();
  }
  document.getElementById('wov-sub').textContent =
    `${DIFF_INFO[curDiff].label} — Level ${curLvlIdx + 1} complete!`;
  document.getElementById('wov-stars').textContent =
    '★'.repeat(s) + '☆'.repeat(3 - s);
  document.getElementById('wov-stars').style.color =
    s === 3 ? '#f59e0b' : s === 2 ? '#94a3b8' : '#6b7280';
  document.getElementById('wov-moves').textContent  = moves;
  document.getElementById('wov-time').textContent   = secs;
  document.getElementById('wov-stars2').textContent = s + '/3';

  const nextBtn = document.getElementById('wov-next');
  nextBtn.style.display = curLvlIdx < 9 ? '' : 'none';
  showOv('win-ov');
}

// ─── NAVIGATION HELPERS ───────────────────────────────────────────────────────
function nextLevel() {
  hideOv('win-ov');
  if (curLvlIdx < 9) { curLvlIdx++; startLevel(curDiff, curLvlIdx); }
  else goLevels();
}

function restartLevel() { buildGame(); }

function goLevels() {
  clearInterval(timerInt);
  document.getElementById('game').style.display = 'none';
  showLevelSelect();
}

function showOv(id) { document.getElementById(id).classList.add('show'); }
function hideOv(id) { document.getElementById(id).classList.remove('show'); }

// ─── RESPONSIVE RE-RENDER ─────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (document.getElementById('game').style.display === 'flex') renderBoard();
});
