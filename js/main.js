/**
 * Bubble Splash! — preschool ocean play (trackpad + any key).
 * Dolphin buddy, rising treasures, mash-key chaos. No fail states.
 */
import { sfx, startMusic } from './audio.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);

const ASSETS = {
  bg: 'assets/bg/meadow.jpg',
  girl: 'assets/chars/sam.png',
  cat: 'assets/chars/bob.png',
  duck: 'assets/items/coin.png',
  shell: 'assets/items/clover.png',
  starfish: 'assets/items/star.png',
  fish: 'assets/items/fish.png',
  pearl: 'assets/items/pearl.png',
  treasure: 'assets/items/treasure.png',
  seahorse: 'assets/items/seahorse.png',
  bubble: 'assets/items/bubble.png',
};

const imgs = {};
const ITEM_KEYS = ['duck', 'shell', 'starfish', 'fish', 'pearl', 'treasure', 'seahorse', 'bubble'];
const CHEERS = ['Yay!', 'Splash!', 'Wow!', 'Bubbles!', 'Amazing!', 'Hooray!', 'Swim!', 'Treasure!', 'So cool!'];
const CAT_LOVE = ['Splash!', 'Eee-eee!', 'Love!', 'Swim!', 'Bubble hug!', 'Best friend!', 'Dolphin!', 'Whee!'];

let W = 800;
let H = 600;
let playing = false;
let score = 0;
let nextCheer = 5;
let pets = 0;
let time = 0;
let last = 0;

const mouse = { x: 400, y: 300 };
const player = { x: 400, y: 400, scale: 1, bounce: 0, facing: 1, trail: 0 };

const cat = {
  x: 200,
  y: 380,
  vx: 60,
  bounce: 0,
  facing: 1,
  mode: 'wander', // wander | follow | play | snuggle
  modeT: 3,
  love: 0,
  spin: 0,
  scale: 1,
  heartT: 0,
  pulse: 0,
};

const items = [];
const particles = [];
const floats = [];
const hearts = [];
const fireworks = [];
const ambient = []; // rising background bubbles
let flashColor = null;
let flashT = 0;
let shakeT = 0;
let lastKeyFx = 0;
let causticT = 0;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAll() {
  await Promise.all(
    Object.entries(ASSETS).map(async ([k, src]) => {
      imgs[k] = await loadImage(src);
    })
  );
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  W = Math.max(320, r.width || window.innerWidth);
  H = Math.max(320, r.height || window.innerHeight);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  player.x = clamp(player.x, 50, W - 50);
  player.y = clamp(player.y, 80, H - 40);
}
window.addEventListener('resize', resize);

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function catDims() {
  const h = Math.min(220, H * 0.32) * cat.scale;
  return { w: h * 1.05, h };
}

function catCenter() {
  return { x: cat.x, y: cat.y + cat.bounce };
}

function distPlayerCat() {
  const c = catCenter();
  return Math.hypot(player.x - c.x, player.y - 30 - c.y);
}

/** Very forgiving hit test — whole dolphin + big padding for little hands */
function hitCat(sx, sy) {
  const { w, h } = catDims();
  const c = catCenter();
  const pad = 55;
  return (
    sx > c.x - w * 0.55 - pad &&
    sx < c.x + w * 0.55 + pad &&
    sy > c.y - h * 0.55 - pad &&
    sy < c.y + h * 0.55 + pad
  );
}

function spawnItem(x) {
  items.push({
    kind: ITEM_KEYS[(Math.random() * ITEM_KEYS.length) | 0],
    x: x ?? 60 + Math.random() * (W - 120),
    y: -50 - Math.random() * 80,
    r: 48 + Math.random() * 18,
    vy: 28 + Math.random() * 40,
    spin: (Math.random() - 0.5) * 0.9,
    ang: Math.random() * 6,
    bob: Math.random() * 6,
    taken: false,
    glow: 0.5 + Math.random() * 0.5,
  });
}

function burst(x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 200;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 60,
      r: 4 + Math.random() * 10,
      life: 0.55 + Math.random() * 0.45,
      max: 1,
      color,
      g: 180,
      bubble: Math.random() < 0.45,
    });
  }
}

function spawnHeart(x, y) {
  hearts.push({
    x: x + (Math.random() - 0.5) * 40,
    y: y - 10,
    vy: -55 - Math.random() * 40,
    life: 1.3,
    size: 20 + Math.random() * 18,
    phase: Math.random() * 6,
    emoji: Math.random() < 0.5 ? '🫧' : '💙',
  });
}

function floatText(x, y, text) {
  floats.push({ x, y, text, life: 1.25, vy: -60 });
}

function showCheer(text) {
  const el = $('#cheer');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(showCheer._t);
  showCheer._t = setTimeout(() => el.classList.add('hidden'), 1000);
}

function setTip(html) {
  const tip = $('#tip');
  if (tip) tip.innerHTML = html;
}

function bumpScore(n = 1) {
  score += n;
  const el = $('#score');
  if (el) el.textContent = String(score);
}

function collect(item) {
  if (item.taken) return;
  item.taken = true;
  bumpScore(1);
  sfx.collect();
  const colors = ['#5ec8ff', '#7dffff', '#80ffd0', '#ffe566', '#ffb347', '#a0e8ff', '#80a0ff'];
  burst(item.x, item.y, colors[(Math.random() * colors.length) | 0], 22);
  floatText(item.x, item.y - 20, '+1 🫧');
  player.bounce = Math.max(player.bounce, 0.55);
  if (score >= nextCheer) {
    nextCheer += 5;
    showCheer(CHEERS[(Math.random() * CHEERS.length) | 0]);
    sfx.cheer();
    flashColor = '#7dffff';
    flashT = 0.15;
  }
}

/** ALWAYS works — call dolphin or splash/play */
function playWithCat(force = false) {
  const d = distPlayerCat();

  if (!force && d > 160) {
    cat.mode = 'follow';
    cat.modeT = 5;
    cat.love = Math.min(1, cat.love + 0.15);
    sfx.meow();
    floatText(cat.x, cat.y - 80, 'Coming!');
    burst(cat.x, cat.y, '#5ec8ff', 16);
    setTip('Dolphin is swimming over! 🐬 Stay still… then splash!');
    showCheer('Here, dolphin!');
    return;
  }

  pets += 1;
  cat.love = 1;
  cat.scale = 1.3;
  cat.mode = 'snuggle';
  cat.modeT = 3;
  cat.pulse = 1;

  cat.x = player.x + (player.facing > 0 ? -70 : 70);
  cat.y = H * 0.56;
  cat.facing = player.facing > 0 ? 1 : -1;

  try {
    sfx.purr();
    sfx.meow();
  } catch (_) {}

  for (let i = 0; i < 10; i++) spawnHeart(cat.x, cat.y - 40);
  burst(cat.x, cat.y - 20, '#5ec8ff', 32);
  burst(player.x, player.y - 40, '#7dffff', 16);
  floatText(cat.x, cat.y - 90, CAT_LOVE[(Math.random() * CAT_LOVE.length) | 0]);

  player.bounce = 1;
  player.scale = 1.18;

  bumpScore(1);
  floatText(player.x, player.y - 100, '+1 🫧');

  if (pets === 1 || pets % 2 === 0) {
    showCheer(pets === 1 ? 'Splash buddy!' : 'Dolphin loves you!');
    sfx.cheer();
  }

  setTip('💙 Bubbly hug! Press <kbd>ANY KEY</kbd> again · Or chase!');
  spawnItem(cat.x);
}

function doPlayChase() {
  cat.mode = 'play';
  cat.modeT = 3.2;
  cat.spin = Math.PI * 6;
  cat.vx = (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 90);
  cat.scale = 1.2;
  sfx.play();
  sfx.meow();
  burst(cat.x, cat.y, '#7dffff', 24);
  floatText(cat.x, cat.y - 80, 'Catch me!');
  showCheer('Swim!');
  setTip('Swim after the dolphin with the trackpad! 🐬💨');
}

function doMagic() {
  if (hitCat(mouse.x, mouse.y)) {
    playWithCat(true);
    return;
  }
  const d = distPlayerCat();
  if (d < 200) {
    if (cat.mode === 'snuggle' && Math.random() < 0.4) doPlayChase();
    else playWithCat(true);
    return;
  }
  playWithCat(false);
  sfx.magic();
  player.bounce = 0.7;
  burst(player.x, player.y - 40, '#5ec8ff', 16);
}

const CRAZY_WORDS = [
  'SPLASH!', 'Whee!', 'Zoom!', 'Pop!', 'Wow!', 'Yay!', 'Bubbles!',
  'Whoosh!', 'Wave!', 'Magic!', 'Giggle!', 'Super!', 'Party!',
  'Swim!', 'Zing!', 'Blast!', 'Whoa!', 'Yippee!', 'Treasure!',
];
const CRAZY_COLORS = [
  '#5ec8ff', '#7dffff', '#80ffd0', '#80a0ff', '#00d4ff',
  '#ffb347', '#a0e8ff', '#40c8ff', '#ffe566', '#90ffc0',
];

/** Any key / button mash → guaranteed cool chaos for a 3yo */
function doCrazyStuff(seed = 0) {
  const now = performance.now();
  if (now - lastKeyFx < 40) return;
  lastKeyFx = now;

  sfx.unlock();
  const pick = seed % 10;
  const color = CRAZY_COLORS[seed % CRAZY_COLORS.length];
  const word = CRAZY_WORDS[seed % CRAZY_WORDS.length];

  sfx.crazy(seed);
  bumpScore(1);
  floatText(
    player.x + (Math.random() - 0.5) * 80,
    player.y - 80 - Math.random() * 40,
    word
  );

  flashColor = color;
  flashT = 0.22;
  shakeT = 0.2;

  player.bounce = 1;
  player.scale = 1.28;

  for (let i = 0; i < 4; i++) {
    fireworks.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.7,
      r: 10,
      maxR: 90 + Math.random() * 120,
      life: 0.65,
      color: CRAZY_COLORS[(seed + i) % CRAZY_COLORS.length],
    });
  }

  burst(player.x, player.y - 40, color, 36);
  burst(Math.random() * W, Math.random() * H * 0.5, CRAZY_COLORS[(seed + 3) % CRAZY_COLORS.length], 24);
  burst(Math.random() * W, Math.random() * H * 0.5, CRAZY_COLORS[(seed + 5) % CRAZY_COLORS.length], 20);

  for (let i = 0; i < 8; i++) {
    spawnHeart(Math.random() * W, H * 0.25 + Math.random() * H * 0.45);
  }

  for (let i = 0; i < 5; i++) {
    spawnItem(40 + Math.random() * (W - 80));
  }

  // Strong magnet — treasures rush to kid
  for (const it of items) {
    if (it.taken) continue;
    it.vy = Math.min(it.vy, 12);
    it.x += (player.x - it.x) * 0.28;
    it.y += (player.y - 50 - it.y) * 0.22;
  }

  switch (pick) {
    case 0:
    case 1:
      playWithCat(true);
      break;
    case 2:
    case 3:
      doPlayChase();
      break;
    case 4:
      cat.mode = 'follow';
      cat.modeT = 4;
      cat.scale = 1.35;
      sfx.meow();
      floatText(cat.x, cat.y - 70, 'Eee-eee!');
      break;
    case 5:
      cat.spin = Math.PI * 12;
      cat.mode = 'play';
      cat.modeT = 2.2;
      sfx.boing();
      showCheer('Spinny fish!');
      break;
    case 6:
      sfx.whoosh();
      player.x = clamp(player.x + (Math.random() < 0.5 ? -140 : 140), 60, W - 60);
      mouse.x = player.x;
      showCheer('Zoom!');
      break;
    case 7:
      sfx.fanfare();
      showCheer(word);
      cat.love = 1;
      for (let i = 0; i < 14; i++) spawnHeart(W * Math.random(), H * 0.5);
      break;
    case 8:
      sfx.bubbleParty();
      showCheer('BUBBLE PARTY!');
      for (let i = 0; i < 10; i++) {
        burst(Math.random() * W, Math.random() * H * 0.6, CRAZY_COLORS[i % CRAZY_COLORS.length], 14);
      }
      break;
    default:
      sfx.bigPop();
      sfx.magic();
      showCheer(word);
      playWithCat(false);
      break;
  }

  if (score > 0 && score % 10 === 0) {
    sfx.bigPop();
    sfx.fanfare();
    showCheer('SUPER SPLASH!!!');
  }

  setTip('Mash <kbd>ANY KEY</kbd> · Big blue buttons · Trackpad swims! 🌊');
}

function startGame() {
  playing = true;
  score = 0;
  pets = 0;
  nextCheer = 5;
  if ($('#score')) $('#score').textContent = '0';
  $('#title')?.classList.add('hidden');
  $('#hud')?.classList.remove('hidden');
  $('#fun-bar')?.classList.remove('hidden');
  items.length = 0;
  particles.length = 0;
  floats.length = 0;
  hearts.length = 0;
  ambient.length = 0;
  player.x = W / 2;
  player.y = H * 0.6;
  mouse.x = player.x;
  mouse.y = player.y;
  cat.x = W * 0.28;
  cat.y = H * 0.56;
  cat.vx = 70;
  cat.mode = 'follow';
  cat.modeT = 4;
  cat.love = 0.5;
  cat.scale = 1;
  for (let i = 0; i < 10; i++) spawnItem();
  for (let i = 0; i < 18; i++) spawnAmbient(true);
  sfx.unlock();
  sfx.start();
  sfx.meow();
  startMusic();
  showCheer('Mash any key!');
  setTip('Press <kbd>ANY KEY</kbd> for splashy chaos · Blue buttons too! 🌊');
  $('#btn-party')?.classList.remove('hidden');
}

function spawnAmbient(anywhere = false) {
  ambient.push({
    x: Math.random() * W,
    y: anywhere ? Math.random() * H : H + 20 + Math.random() * 40,
    r: 3 + Math.random() * 14,
    vy: -(20 + Math.random() * 45),
    vx: (Math.random() - 0.5) * 18,
    life: 4 + Math.random() * 5,
    phase: Math.random() * 6,
  });
}

// ── Input ──
window.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});

window.addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('button,a')) return;
  if (!playing) return;
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
  if (hitCat(mouse.x, mouse.y)) playWithCat(true);
  else doCrazyStuff((performance.now() | 0) % 99);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
  e.preventDefault();
  sfx.unlock();

  if (!playing) {
    startGame();
    setTimeout(() => doCrazyStuff((e.key && e.key.charCodeAt?.(0)) || 12), 40);
    return;
  }

  const seed = (e.key && e.key.length === 1)
    ? e.key.toUpperCase().charCodeAt(0)
    : (e.code.charCodeAt(e.code.length - 1) || 13) + e.code.length * 3;
  doCrazyStuff(seed);
});

$('#btn-play')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  sfx.unlock();
  startGame();
});

$('#btn-pet')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!playing) startGame();
  sfx.unlock();
  playWithCat(true);
  doCrazyStuff(65);
});

$('#btn-party')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!playing) startGame();
  sfx.unlock();
  sfx.bubbleParty();
  doCrazyStuff((Math.random() * 90) | 0);
  setTimeout(() => {
    sfx.bigPop();
    doCrazyStuff(((Math.random() * 90) | 0) + 5);
  }, 90);
  setTimeout(() => {
    sfx.bubbleParty();
    doCrazyStuff(((Math.random() * 90) | 0) + 11);
  }, 180);
});

function updateCat(dt) {
  cat.modeT -= dt;
  cat.love = Math.max(0, cat.love - dt * 0.05);
  cat.scale += (1 - cat.scale) * Math.min(1, dt * 4);
  cat.pulse = Math.max(0, cat.pulse - dt);
  if (cat.spin > 0) cat.spin = Math.max(0, cat.spin - dt * 10);

  const baseY = H * 0.56;
  const d = distPlayerCat();

  if (cat.mode === 'snuggle') {
    cat.x += (player.x + (player.facing > 0 ? -65 : 65) - cat.x) * Math.min(1, dt * 6);
    cat.y = baseY + Math.sin(time * 5) * 10;
    cat.bounce = Math.abs(Math.sin(time * 8)) * 14;
    cat.facing = player.x >= cat.x ? 1 : -1;
    cat.heartT -= dt;
    if (cat.heartT <= 0) {
      cat.heartT = 0.3;
      spawnHeart(cat.x, cat.y - 50);
    }
    if (cat.modeT <= 0) {
      cat.mode = 'follow';
      cat.modeT = 3;
    }
  } else if (cat.mode === 'follow') {
    const tx = player.x + (player.facing > 0 ? -85 : 85);
    const dx = tx - cat.x;
    cat.x += Math.sign(dx || 1) * Math.min(Math.abs(dx), 190 * dt);
    cat.facing = dx >= 0 ? 1 : -1;
    cat.y = baseY + Math.sin(time * 3.2) * 14;
    cat.bounce = Math.sin(time * 7) * 12;
    if (d < 100) {
      cat.mode = 'snuggle';
      cat.modeT = 2.2;
      if (Math.random() < 0.4) sfx.purr();
      spawnHeart(cat.x, cat.y - 40);
    }
    if (cat.modeT <= 0) {
      cat.mode = 'wander';
      cat.modeT = 2 + Math.random() * 2;
    }
  } else if (cat.mode === 'play') {
    cat.x += cat.vx * dt;
    if (cat.x < 80 || cat.x > W - 80) cat.vx *= -1;
    cat.facing = cat.vx >= 0 ? 1 : -1;
    cat.y = baseY + Math.sin(time * 11) * 24;
    cat.bounce = Math.abs(Math.sin(time * 14)) * 20;
    if (d < 90) playWithCat(true);
    if (cat.modeT <= 0) {
      cat.mode = 'follow';
      cat.modeT = 3;
    }
  } else {
    cat.x += cat.vx * dt;
    if (cat.x < 80 || cat.x > W - 80) cat.vx *= -1;
    cat.facing = cat.vx >= 0 ? 1 : -1;
    cat.y = baseY + Math.sin(time * 2.2) * 16;
    cat.bounce = Math.sin(time * 4) * 8;
    if (d < 200) {
      cat.mode = 'follow';
      cat.modeT = 4;
    }
    if (cat.modeT <= 0) {
      cat.vx = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 45);
      cat.modeT = 2 + Math.random() * 3;
    }
  }
}

function update(dt) {
  time += dt;
  causticT += dt;
  if (flashT > 0) flashT -= dt;
  if (shakeT > 0) shakeT -= dt;

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    f.life -= dt;
    f.r += (f.maxR - f.r) * Math.min(1, dt * 6);
    if (f.life <= 0) fireworks.splice(i, 1);
  }

  const ease = Math.min(1, dt * 8);
  const tx = clamp(mouse.x, 50, W - 50);
  const ty = clamp(mouse.y, 80, H - 40);
  const ox = player.x;
  const oy = player.y;
  player.x += (tx - player.x) * ease;
  player.y += (ty - player.y) * ease;
  if (player.x > ox + 0.4) player.facing = 1;
  if (player.x < ox - 0.4) player.facing = -1;
  const sped = Math.hypot(player.x - ox, player.y - oy);
  player.trail = Math.min(1, player.trail * 0.9 + sped * 0.04);
  player.bounce = Math.max(0, player.bounce - dt * 3);
  player.scale += ((1 + player.bounce * 0.14) - player.scale) * Math.min(1, dt * 8);

  // swim bubble trail
  if (player.trail > 0.15 && Math.random() < player.trail * 0.5) {
    particles.push({
      x: player.x + (Math.random() - 0.5) * 30,
      y: player.y + 10,
      vx: (Math.random() - 0.5) * 20,
      vy: 30 + Math.random() * 20,
      r: 3 + Math.random() * 6,
      life: 0.5,
      max: 0.5,
      color: 'rgba(200,240,255,0.7)',
      g: -40,
      bubble: true,
    });
  }

  updateCat(dt);

  // ambient bubbles
  if (ambient.length < 22 && Math.random() < 0.08) spawnAmbient(false);
  for (let i = ambient.length - 1; i >= 0; i--) {
    const b = ambient[i];
    b.life -= dt;
    b.y += b.vy * dt;
    b.x += b.vx * dt + Math.sin(time * 2 + b.phase) * 12 * dt;
    if (b.life <= 0 || b.y < -30) ambient.splice(i, 1);
  }

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.life -= dt;
    h.y += h.vy * dt;
    h.x += Math.sin(time * 5 + h.phase) * 28 * dt;
    if (h.life <= 0) hearts.splice(i, 1);
  }

  for (const it of items) {
    if (it.taken) continue;
    it.y += it.vy * dt;
    it.ang += it.spin * dt;
    it.bob += dt * 2.6;
    it.x += Math.sin(it.bob) * 14 * dt;
    // gentle float (less gravity feel)
    it.vy += Math.sin(it.bob * 0.7) * 8 * dt;
    it.vy = clamp(it.vy, 12, 70);
    if (it.y > H + 50) {
      it.y = -40;
      it.x = 60 + Math.random() * (W - 120);
    }
    // big collect radius for little hands
    if (Math.hypot(player.x - it.x, player.y - 40 - it.y) < it.r + 64) collect(it);
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].taken) items.splice(i, 1);
  }
  while (items.length < 12) spawnItem();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    if (f.life <= 0) {
      floats.splice(i, 1);
      continue;
    }
    f.y += f.vy * dt;
  }
}

function drawImg(img, x, y, w, h, flip = false, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  else {
    ctx.fillStyle = '#7dffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  ctx.save();
  if (shakeT > 0) {
    ctx.translate(
      (Math.random() - 0.5) * 16 * shakeT * 5,
      (Math.random() - 0.5) * 16 * shakeT * 5
    );
  }

  if (imgs.bg) {
    const s = Math.max(W / imgs.bg.width, H / imgs.bg.height) * 1.05;
    const bw = imgs.bg.width * s;
    const bh = imgs.bg.height * s;
    // gentle parallax drift
    const px = Math.sin(time * 0.15) * 12;
    const py = Math.cos(time * 0.12) * 8;
    ctx.drawImage(imgs.bg, (W - bw) / 2 + px, (H - bh) / 2 + py, bw, bh);
  } else {
    ctx.fillStyle = '#1a8fd4';
    ctx.fillRect(0, 0, W, H);
  }

  // soft light caustics
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.15 + i * 0.18) + Math.sin(causticT * 0.7 + i) * 40;
    const cy = H * 0.2 + Math.cos(causticT * 0.5 + i * 1.3) * 30;
    const grd = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120 + i * 20);
    grd.addColorStop(0, 'rgba(255,255,200,0.9)');
    grd.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 140 + i * 15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ambient bubbles (behind characters)
  for (const b of ambient) {
    ctx.globalAlpha = Math.min(0.55, b.life * 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.min(0.25, b.life * 0.12);
    ctx.fillStyle = '#dff8ff';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // treasures
  for (const it of items) {
    if (it.taken) continue;
    const bob = Math.sin(it.bob) * 8;
    const pulse = 0.55 + Math.sin(time * 3 + it.bob) * 0.2;
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    ctx.rotate(it.ang * 0.2);
    // soft aqua glow
    ctx.globalAlpha = 0.35 * pulse * it.glow;
    ctx.fillStyle = '#7dffff';
    ctx.beginPath();
    ctx.arc(0, 0, it.r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawImg(imgs[it.kind], 0, 0, it.r * 2.05, it.r * 2.05);
    ctx.restore();
  }

  // DOLPHIN
  const catH = Math.min(220, H * 0.32) * cat.scale;
  const catW = catH * 1.05;
  const cy = cat.y + cat.bounce;

  const pulse = 0.3 + Math.sin(time * 2.8) * 0.12 + cat.pulse * 0.45;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#5ec8ff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(cat.x, cy + 8, catW * 0.62, catH * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.18 + cat.love * 0.28;
  ctx.fillStyle = '#7dffff';
  ctx.beginPath();
  ctx.ellipse(cat.x, cy + 8, catW * 0.68, catH * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // soft shadow
  ctx.fillStyle = 'rgba(10, 40, 80, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cat.x, cat.y + catH * 0.42, catW * 0.38, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  drawImg(imgs.cat, cat.x, cy, catW, catH, cat.facing < 0, cat.spin > 0 ? cat.spin : 0);

  // dolphin speech — ocean themed
  if (playing) {
    const bubble =
      cat.mode === 'snuggle' ? 'Splash! 💙' :
      cat.mode === 'play' ? 'Catch me!' :
      cat.mode === 'follow' ? 'Hi friend!' :
      'Splash me! 🫧';
    ctx.font = '900 22px Nunito, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(bubble).width;
    const bx = cat.x;
    const by = cy - catH * 0.52;
    ctx.fillStyle = 'rgba(240, 251, 255, 0.96)';
    ctx.strokeStyle = '#3ec0ff';
    ctx.lineWidth = 4;
    roundRect(ctx, bx - tw / 2 - 14, by - 24, tw + 28, 40, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0a6ea8';
    ctx.fillText(bubble, bx, by + 5);
  }

  for (const h of hearts) {
    ctx.globalAlpha = Math.max(0, h.life);
    ctx.font = `${h.size}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(h.emoji || '🫧', h.x, h.y);
  }
  ctx.globalAlpha = 1;

  // player (bigger)
  ctx.fillStyle = 'rgba(10, 40, 80, 0.2)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 14, 52 * player.scale, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  const ph = Math.min(240, H * 0.38) * player.scale;
  const pw = ph * 0.78;
  const py = player.y - ph * 0.32 + Math.sin(time * 5.5) * 6 - player.bounce * 20;
  // soft aqua halo so kid pops off busy reef
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#dff8ff';
  ctx.beginPath();
  ctx.ellipse(player.x, py + 10, pw * 0.55, ph * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawImg(imgs.girl, player.x, py, pw, ph, player.facing < 0);

  // particles on top
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / (p.max || 1));
    if (p.bubble) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,245,255,0.35)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.2, p.y - p.r * 0.2, p.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = '900 30px Nunito, sans-serif';
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = '#00a0e0';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  for (const f of fireworks) {
    ctx.globalAlpha = Math.max(0, f.life * 1.4);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, f.life * 0.5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (playing) {
    const on = hitCat(mouse.x, mouse.y);
    ctx.strokeStyle = on ? '#5ec8ff' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, on ? 28 : 16, 0, Math.PI * 2);
    ctx.stroke();
    if (on) {
      ctx.font = '24px serif';
      ctx.fillText('🐬', mouse.x, mouse.y + 8);
    }
  }

  ctx.restore();

  if (flashT > 0 && flashColor) {
    ctx.globalAlpha = Math.min(0.4, flashT * 2);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (playing) update(dt);
  else {
    time += dt;
    // idle ambient on title
    if (ambient.length < 14 && Math.random() < 0.05) spawnAmbient(true);
    for (let i = ambient.length - 1; i >= 0; i--) {
      const b = ambient[i];
      b.life -= dt;
      b.y += b.vy * dt;
      b.x += b.vx * dt + Math.sin(time * 2 + b.phase) * 12 * dt;
      if (b.life <= 0 || b.y < -30) ambient.splice(i, 1);
    }
  }
  draw();
  requestAnimationFrame(frame);
}

(async function boot() {
  resize();
  await loadAll();
  for (let i = 0; i < 8; i++) spawnItem();
  for (let i = 0; i < 16; i++) spawnAmbient(true);
  cat.x = W * 0.32;
  cat.y = H * 0.55;
  last = performance.now();
  requestAnimationFrame(frame);
})();
