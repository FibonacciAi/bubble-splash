/**
 * Bubble Splash! — preschool ocean play (trackpad + any key).
 * Dolphin play is the star: big hit targets, always call/splash, no fail.
 */
import { sfx, startMusic } from './audio.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);

const ASSETS = {
  bg: 'assets/bg/meadow.jpg',
  girl: 'assets/chars/sam.png',
  cat: 'assets/chars/bob.png',
  coin: 'assets/items/coin.png',
  clover: 'assets/items/clover.png',
  star: 'assets/items/star.png',
  heart: 'assets/items/heart.png',
  crystal: 'assets/items/crystal.png',
};

const imgs = {};
const ITEM_KEYS = ['coin', 'clover', 'star', 'heart', 'crystal'];
const CHEERS = ['Yay!', 'Splash!', 'Wow!', 'Bubbles!', 'Amazing!', 'Hooray!', 'Swim!'];
const CAT_LOVE = ['Splash!', 'Eee-eee!', 'Love!', 'Swim!', 'Bubble hug!', 'Best friend!', 'Dolphin!'];

let W = 800;
let H = 600;
let playing = false;
let score = 0;
let nextCheer = 5;
let pets = 0;
let time = 0;
let last = 0;

const mouse = { x: 400, y: 300 };
const player = { x: 400, y: 400, scale: 1, bounce: 0, facing: 1 };

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
  pulse: 0, // visual “come splash me” pulse
};

const items = [];
const particles = [];
const floats = [];
const hearts = [];
const fireworks = []; // screen rings / flashes
let flashColor = null;
let flashT = 0;
let shakeT = 0;
let lastKeyFx = 0;

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
  const h = Math.min(190, H * 0.28) * cat.scale;
  return { w: h * 0.95, h };
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
  const pad = 50;
  return (
    sx > c.x - w * 0.6 - pad &&
    sx < c.x + w * 0.6 + pad &&
    sy > c.y - h * 0.55 - pad &&
    sy < c.y + h * 0.55 + pad
  );
}

function spawnItem(x) {
  items.push({
    kind: ITEM_KEYS[(Math.random() * ITEM_KEYS.length) | 0],
    x: x ?? 60 + Math.random() * (W - 120),
    y: -50 - Math.random() * 60,
    r: 40 + Math.random() * 16,
    vy: 35 + Math.random() * 45,
    spin: (Math.random() - 0.5) * 1.2,
    ang: Math.random() * 6,
    bob: Math.random() * 6,
    taken: false,
  });
}

function burst(x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 70 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 50,
      r: 5 + Math.random() * 8,
      life: 0.55 + Math.random() * 0.4,
      max: 1,
      color,
      g: 260,
    });
  }
}

function spawnHeart(x, y) {
  hearts.push({
    x: x + (Math.random() - 0.5) * 40,
    y: y - 10,
    vy: -50 - Math.random() * 40,
    life: 1.2,
    size: 22 + Math.random() * 16,
    phase: Math.random() * 6,
  });
}

function floatText(x, y, text) {
  floats.push({ x, y, text, life: 1.2, vy: -55 });
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
  const colors = ['#ff6eb4', '#ffe566', '#7ed957', '#5ec8ff', '#c9a0ff', '#ffb347'];
  burst(item.x, item.y, colors[(Math.random() * colors.length) | 0], 16);
  floatText(item.x, item.y - 20, '+1 ⭐');
  if (score >= nextCheer) {
    nextCheer += 5;
    showCheer(CHEERS[(Math.random() * CHEERS.length) | 0]);
    sfx.cheer();
  }
}

/** ALWAYS works — call dolphin or splash/play */
function playWithCat(force = false) {
  const d = distPlayerCat();

  // Far away: call dolphin to come (this is the “didn't work” fix — always a response)
  if (!force && d > 160) {
    cat.mode = 'follow';
    cat.modeT = 5;
    cat.love = Math.min(1, cat.love + 0.15);
    sfx.meow();
    floatText(cat.x, cat.y - 80, 'Coming!');
    burst(cat.x, cat.y, '#5ec8ff', 12);
    setTip('Dolphin is swimming over! 🐬 Stay still… then splash!');
    showCheer('Here, dolphin!');
    return;
  }

  pets += 1;
  cat.love = 1;
  cat.scale = 1.25;
  cat.mode = 'snuggle';
  cat.modeT = 3;
  cat.pulse = 1;

  // Snap friend next to player so splash always lands
  cat.x = player.x + (player.facing > 0 ? -55 : 55);
  cat.y = H * 0.58;
  cat.facing = player.facing > 0 ? 1 : -1;

  try {
    sfx.purr();
    sfx.meow();
  } catch (_) {}

  for (let i = 0; i < 8; i++) spawnHeart(cat.x, cat.y - 40);
  burst(cat.x, cat.y - 20, '#5ec8ff', 28);
  burst(player.x, player.y - 40, '#7dffff', 12);
  floatText(cat.x, cat.y - 90, CAT_LOVE[(Math.random() * CAT_LOVE.length) | 0]);

  player.bounce = 1;
  player.scale = 1.15;

  bumpScore(1);
  floatText(player.x, player.y - 100, '+1 🫧');

  if (pets === 1 || pets % 2 === 0) {
    showCheer(pets === 1 ? 'Splash buddy!' : 'Dolphin loves you!');
    sfx.cheer();
  }

  setTip('💕 Bubbly hug! Press <kbd>ANY KEY</kbd> again · Or chase!');
  spawnItem(cat.x);
}

function doPlayChase() {
  cat.mode = 'play';
  cat.modeT = 3;
  cat.spin = Math.PI * 6;
  cat.vx = (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 80);
  cat.scale = 1.15;
  sfx.play();
  sfx.meow();
  burst(cat.x, cat.y, '#7dffff', 20);
  floatText(cat.x, cat.y - 80, 'Catch me!');
  showCheer('Swim!');
  setTip('Swim after the dolphin with the trackpad! 🐬💨');
}

function doMagic() {
  // Space / click: if on cat or close → pet; else call cat OR chase if already close
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
  burst(player.x, player.y - 40, '#c9a0ff', 14);
}

const CRAZY_WORDS = [
  'SPLASH!', 'Whee!', 'Zoom!', 'Pop!', 'Wow!', 'Yay!', 'Bubbles!',
  'Whoosh!', 'Wave!', 'Magic!', 'Giggle!', 'Super!', 'Party!',
  'Swim!', 'Zing!', 'Blast!', 'Whoa!', 'Yippee!',
];
const CRAZY_COLORS = [
  '#5ec8ff', '#7dffff', '#80ffd0', '#80a0ff', '#00d4ff',
  '#ffb347', '#a0e8ff', '#40c8ff', '#ffe566', '#90ffc0',
];

/** Any key / button mash → guaranteed cool chaos for a 3yo */
function doCrazyStuff(seed = 0) {
  const now = performance.now();
  // tiny debounce so hold-to-repeat still feels good but not freezes
  if (now - lastKeyFx < 40) return;
  lastKeyFx = now;

  sfx.unlock();
  const pick = seed % 10;
  const color = CRAZY_COLORS[seed % CRAZY_COLORS.length];
  const word = CRAZY_WORDS[seed % CRAZY_WORDS.length];

  // Always: sound + particles + score tick
  sfx.crazy(seed);
  bumpScore(1);
  floatText(
    player.x + (Math.random() - 0.5) * 80,
    player.y - 80 - Math.random() * 40,
    word
  );

  // Screen flash + little shake
  flashColor = color;
  flashT = 0.2;
  shakeT = 0.18;

  player.bounce = 1;
  player.scale = 1.25;

  // Ring fireworks
  for (let i = 0; i < 3; i++) {
    fireworks.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.7,
      r: 10,
      maxR: 80 + Math.random() * 100,
      life: 0.6,
      color: CRAZY_COLORS[(seed + i) % CRAZY_COLORS.length],
    });
  }

  // Big confetti burst at player + random spots
  burst(player.x, player.y - 40, color, 30);
  burst(Math.random() * W, Math.random() * H * 0.5, CRAZY_COLORS[(seed + 3) % CRAZY_COLORS.length], 20);
  burst(Math.random() * W, Math.random() * H * 0.5, CRAZY_COLORS[(seed + 5) % CRAZY_COLORS.length], 16);

  // Hearts rain
  for (let i = 0; i < 6; i++) {
    spawnHeart(Math.random() * W, H * 0.3 + Math.random() * H * 0.4);
  }

  // Rain of lucky items
  for (let i = 0; i < 4; i++) {
    spawnItem(40 + Math.random() * (W - 80));
  }

  // Pull nearby goodies
  for (const it of items) {
    if (it.taken) continue;
    it.vy = Math.min(it.vy, 20);
    it.x += (player.x - it.x) * 0.2;
    it.y += (player.y - 40 - it.y) * 0.15;
  }

  // Cat always reacts somehow
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
      cat.scale = 1.3;
      sfx.meow();
      floatText(cat.x, cat.y - 70, 'Eee-eee!');
      break;
    case 5:
      // Super spin cat
      cat.spin = Math.PI * 10;
      cat.mode = 'play';
      cat.modeT = 2;
      sfx.boing();
      showCheer('Spinny fish!');
      break;
    case 6:
      sfx.whoosh();
      player.x = clamp(player.x + (Math.random() < 0.5 ? -120 : 120), 60, W - 60);
      mouse.x = player.x;
      showCheer('Zoom!');
      break;
    case 7:
      sfx.fanfare();
      showCheer(word);
      cat.love = 1;
      for (let i = 0; i < 12; i++) spawnHeart(W * Math.random(), H * 0.5);
      break;
    case 8:
      sfx.cheer();
      showCheer('BUBBLE PARTY!');
      for (let i = 0; i < 8; i++) {
        burst(Math.random() * W, Math.random() * H * 0.6, CRAZY_COLORS[i % CRAZY_COLORS.length], 10);
      }
      break;
    default:
      sfx.pop();
      sfx.magic();
      showCheer(word);
      playWithCat(false);
      break;
  }

  if (score > 0 && score % 10 === 0) {
    sfx.fanfare();
    showCheer('SUPER SPLASH!!!');
  }

  setTip('Mash <kbd>ANY KEY</kbd> · Blue buttons · Trackpad swims you! 🌊');
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
  player.x = W / 2;
  player.y = H * 0.62;
  mouse.x = player.x;
  mouse.y = player.y;
  cat.x = W * 0.3;
  cat.y = H * 0.58;
  cat.vx = 55;
  cat.mode = 'follow'; // start by coming to her!
  cat.modeT = 4;
  cat.love = 0.4;
  cat.scale = 1;
  for (let i = 0; i < 8; i++) spawnItem();
  sfx.unlock();
  sfx.start();
  sfx.meow();
  startMusic();
  showCheer('Mash any key!');
  setTip('Press <kbd>ANY KEY</kbd> for splashy chaos · Blue buttons too! 🌊');
  $('#btn-party')?.classList.remove('hidden');
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
  // Skip lone modifiers
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
  doCrazyStuff((Math.random() * 90) | 0);
  setTimeout(() => doCrazyStuff(((Math.random() * 90) | 0) + 5), 80);
});

function updateCat(dt) {
  cat.modeT -= dt;
  cat.love = Math.max(0, cat.love - dt * 0.05);
  cat.scale += (1 - cat.scale) * Math.min(1, dt * 4);
  cat.pulse = Math.max(0, cat.pulse - dt);
  if (cat.spin > 0) cat.spin = Math.max(0, cat.spin - dt * 10);

  const baseY = H * 0.58;
  const d = distPlayerCat();

  if (cat.mode === 'snuggle') {
    cat.x += (player.x + (player.facing > 0 ? -50 : 50) - cat.x) * Math.min(1, dt * 6);
    cat.y = baseY + Math.sin(time * 6) * 6;
    cat.bounce = Math.abs(Math.sin(time * 9)) * 12;
    cat.facing = player.x >= cat.x ? 1 : -1;
    cat.heartT -= dt;
    if (cat.heartT <= 0) {
      cat.heartT = 0.35;
      spawnHeart(cat.x, cat.y - 50);
    }
    if (cat.modeT <= 0) {
      cat.mode = 'follow';
      cat.modeT = 3;
    }
  } else if (cat.mode === 'follow') {
    const tx = player.x + (player.facing > 0 ? -70 : 70);
    const dx = tx - cat.x;
    cat.x += Math.sign(dx || 1) * Math.min(Math.abs(dx), 160 * dt);
    cat.facing = dx >= 0 ? 1 : -1;
    cat.y = baseY + Math.sin(time * 3) * 10;
    cat.bounce = Math.sin(time * 8) * 10;
    if (d < 90) {
      // auto-snuggle when close enough — key for 3yo
      cat.mode = 'snuggle';
      cat.modeT = 2;
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
    cat.y = baseY + Math.sin(time * 11) * 20;
    cat.bounce = Math.abs(Math.sin(time * 14)) * 18;
    if (d < 85) {
      // caught the cat!
      playWithCat(true);
    }
    if (cat.modeT <= 0) {
      cat.mode = 'follow';
      cat.modeT = 3;
    }
  } else {
    // wander
    cat.x += cat.vx * dt;
    if (cat.x < 80 || cat.x > W - 80) cat.vx *= -1;
    cat.facing = cat.vx >= 0 ? 1 : -1;
    cat.y = baseY + Math.sin(time * 2) * 12;
    cat.bounce = Math.sin(time * 4) * 6;
    if (d < 180) {
      cat.mode = 'follow';
      cat.modeT = 4;
    }
    if (cat.modeT <= 0) {
      cat.vx = (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 40);
      cat.modeT = 2 + Math.random() * 3;
    }
  }
}

function update(dt) {
  time += dt;
  if (flashT > 0) flashT -= dt;
  if (shakeT > 0) shakeT -= dt;

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    f.life -= dt;
    f.r += (f.maxR - f.r) * Math.min(1, dt * 6);
    if (f.life <= 0) fireworks.splice(i, 1);
  }

  const ease = Math.min(1, dt * 7);
  const tx = clamp(mouse.x, 50, W - 50);
  const ty = clamp(mouse.y, 80, H - 40);
  const ox = player.x;
  player.x += (tx - player.x) * ease;
  player.y += (ty - player.y) * ease;
  if (player.x > ox + 0.4) player.facing = 1;
  if (player.x < ox - 0.4) player.facing = -1;
  player.bounce = Math.max(0, player.bounce - dt * 3);
  player.scale += ((1 + player.bounce * 0.12) - player.scale) * Math.min(1, dt * 8);

  updateCat(dt);

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.life -= dt;
    h.y += h.vy * dt;
    h.x += Math.sin(time * 5 + h.phase) * 25 * dt;
    if (h.life <= 0) hearts.splice(i, 1);
  }

  for (const it of items) {
    if (it.taken) continue;
    it.y += it.vy * dt;
    it.ang += it.spin * dt;
    it.bob += dt * 3;
    it.x += Math.sin(it.bob) * 10 * dt;
    if (it.y > H + 50) {
      it.y = -40;
      it.x = 60 + Math.random() * (W - 120);
    }
    if (Math.hypot(player.x - it.x, player.y - 50 - it.y) < it.r + 52) collect(it);
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].taken) items.splice(i, 1);
  }
  while (items.length < 10) spawnItem();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    if (f.life <= 0) { floats.splice(i, 1); continue; }
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
    ctx.fillStyle = '#ffb6d9';
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
      (Math.random() - 0.5) * 14 * shakeT * 5,
      (Math.random() - 0.5) * 14 * shakeT * 5
    );
  }

  if (imgs.bg) {
    const s = Math.max(W / imgs.bg.width, H / imgs.bg.height) * 1.06;
    const bw = imgs.bg.width * s;
    const bh = imgs.bg.height * s;
    ctx.drawImage(imgs.bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
  } else {
    ctx.fillStyle = '#c8f0ff';
    ctx.fillRect(0, 0, W, H);
  }

  // items
  for (const it of items) {
    if (it.taken) continue;
    const bob = Math.sin(it.bob) * 6;
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    ctx.rotate(it.ang * 0.25);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff8a0';
    ctx.beginPath();
    ctx.arc(0, 0, it.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawImg(imgs[it.kind], 0, 0, it.r * 2, it.r * 2);
    ctx.restore();
  }

  // CAT — big and obvious
  const catH = Math.min(190, H * 0.28) * cat.scale;
  const catW = catH * 0.95;
  const cy = cat.y + cat.bounce;

  // pulse ring so kids see the cat is interactive
  const pulse = 0.35 + Math.sin(time * 3) * 0.15 + cat.pulse * 0.4;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ff6eb4';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cat.x, cy + 10, catW * 0.65, catH * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.25 + cat.love * 0.35;
  ctx.fillStyle = '#ff9ed0';
  ctx.beginPath();
  ctx.ellipse(cat.x, cy + 10, catW * 0.7, catH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(80,40,100,0.12)';
  ctx.beginPath();
  ctx.ellipse(cat.x, cat.y + catH * 0.4, catW * 0.4, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  drawImg(imgs.cat, cat.x, cy, catW, catH, cat.facing < 0, cat.spin > 0 ? cat.spin : 0);

  // speech bubble always visible on cat
  if (playing) {
    const bubble =
      cat.mode === 'snuggle' ? 'Splash 💕' :
      cat.mode === 'play' ? 'Catch me!' :
      cat.mode === 'follow' ? 'Hi!' :
      'Splash me! 💕';
    ctx.font = '900 22px Nunito, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(bubble).width;
    const bx = cat.x;
    const by = cy - catH * 0.52;
    ctx.fillStyle = 'rgba(255,253,248,0.96)';
    ctx.strokeStyle = '#ff8ec8';
    ctx.lineWidth = 4;
    roundRect(ctx, bx - tw / 2 - 14, by - 24, tw + 28, 40, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d04090';
    ctx.fillText(bubble, bx, by + 5);
  }

  for (const h of hearts) {
    ctx.globalAlpha = Math.max(0, h.life);
    ctx.font = `${h.size}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('💕', h.x, h.y);
  }
  ctx.globalAlpha = 1;

  // player
  ctx.fillStyle = 'rgba(80,40,100,0.15)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 10, 48 * player.scale, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  const ph = Math.min(200, H * 0.32) * player.scale;
  const pw = ph * 0.9;
  const py = player.y - ph * 0.35 + Math.sin(time * 6) * 4 - player.bounce * 18;
  drawImg(imgs.girl, player.x, py, pw, ph, player.facing < 0);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = '900 28px Nunito, sans-serif';
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = '#ff8a00';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // fireworks rings
  for (const f of fireworks) {
    ctx.globalAlpha = Math.max(0, f.life * 1.4);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (playing) {
    const on = hitCat(mouse.x, mouse.y);
    ctx.strokeStyle = on ? '#ff6eb4' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, on ? 26 : 16, 0, Math.PI * 2);
    ctx.stroke();
    if (on) {
      ctx.font = '22px serif';
      ctx.fillText('🐾', mouse.x, mouse.y + 7);
    }
  }

  ctx.restore();

  // full-screen color flash (after restore so it covers everything)
  if (flashT > 0 && flashColor) {
    ctx.globalAlpha = Math.min(0.45, flashT * 2.2);
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
  else time += dt;
  draw();
  if (!playing) {
    ctx.fillStyle = 'rgba(255,240,250,0.12)';
    ctx.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

(async function boot() {
  resize();
  await loadAll();
  for (let i = 0; i < 6; i++) spawnItem();
  cat.x = W * 0.32;
  cat.y = H * 0.55;
  last = performance.now();
  requestAnimationFrame(frame);
})();
