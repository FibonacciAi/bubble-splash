/** Happy preschool WebAudio — music + sparkly SFX. */

let actx = null;
let muted = false;
let musicNodes = null;
let musicOn = false;

function ac() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Short burst of filtered noise (the wet “pop” body). */
function noiseBurst(dur = 0.12, gain = 0.12, when = 0, freq = 900, q = 1.2) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + when;
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    // soft decay envelope baked into noise
    const env = 1 - i / n;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t0);
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(a.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/**
 * Big juicy bubble pop.
 * @param {number} size 0..1 — bigger = deeper, wetter, louder
 */
function bubblePop(size = 0.75, when = 0) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + when;
  const s = Math.max(0.15, Math.min(1.2, size));

  // 1) Hollow pitch-drop “boop” (the classic bubble)
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  const f0 = 280 + s * 420; // ~280–700 → deep to bright
  const f1 = 60 + s * 90;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + 0.12 + s * 0.1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.14 + s * 0.12, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18 + s * 0.12);
  o.connect(g);
  g.connect(a.destination);
  o.start(t0);
  o.stop(t0 + 0.35);

  // 2) Soft sub thump so it feels BIG
  const sub = a.createOscillator();
  const sg = a.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(90 + s * 40, t0);
  sub.frequency.exponentialRampToValueAtTime(45, t0 + 0.15);
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.1 + s * 0.08, t0 + 0.008);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  sub.connect(sg);
  sg.connect(a.destination);
  sub.start(t0);
  sub.stop(t0 + 0.2);

  // 3) Wet noise snap
  noiseBurst(0.07 + s * 0.06, 0.1 + s * 0.08, when, 700 + s * 500, 0.9);

  // 4) Tiny sparkle ring on top
  const ring = a.createOscillator();
  const rg = a.createGain();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(1200 + s * 800, t0 + 0.02);
  ring.frequency.exponentialRampToValueAtTime(1800 + s * 600, t0 + 0.08);
  rg.gain.setValueAtTime(0.0001, t0 + 0.02);
  rg.gain.exponentialRampToValueAtTime(0.04 + s * 0.03, t0 + 0.03);
  rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  ring.connect(rg);
  rg.connect(a.destination);
  ring.start(t0 + 0.02);
  ring.stop(t0 + 0.16);
}

export const sfx = {
  unlock() { ac(); },
  /** Default pop — medium bubble */
  pop() {
    bubblePop(0.55);
  },
  /** Big satisfying bubble burst */
  bigPop() {
    bubblePop(1.05);
    // delayed second skin-pop for “huge”
    bubblePop(0.45, 0.07);
  },
  /** Multi bubble party — cascade of pops */
  bubbleParty() {
    bubblePop(1.1);
    bubblePop(0.7, 0.06);
    bubblePop(0.9, 0.12);
    bubblePop(0.5, 0.18);
    bubblePop(0.75, 0.24);
    tone(880, 0.12, 'sine', 0.05, 0.1);
    tone(1175, 0.15, 'triangle', 0.04, 0.18);
  },
  collect() {
    // treasure grab = crisp medium pop + sparkle
    bubblePop(0.5 + Math.random() * 0.25);
    tone(880, 0.1, 'sine', 0.05, 0.05);
    tone(1320, 0.12, 'triangle', 0.035, 0.1);
  },
  magic() {
    bubblePop(0.7);
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 0.16, 'sine', 0.05, 0.04 + i * 0.05));
  },
  cheer() {
    bubblePop(0.9);
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, 0.05 + i * 0.07));
  },
  start() {
    bubblePop(0.8);
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.06, 0.05 + i * 0.08));
  },
  meow() {
    // soft dolphin “eee” peep
    tone(720, 0.14, 'triangle', 0.07);
    tone(540, 0.18, 'sine', 0.06, 0.08);
    tone(420, 0.12, 'triangle', 0.04, 0.16);
  },
  purr() {
    tone(90, 0.35, 'sawtooth', 0.025);
    tone(120, 0.3, 'triangle', 0.03, 0.05);
    tone(180, 0.25, 'sine', 0.02, 0.1);
  },
  play() {
    bubblePop(0.45);
    tone(600, 0.1, 'sine', 0.05, 0.04);
    tone(800, 0.1, 'triangle', 0.04, 0.1);
  },
  /** Random fun blip — always a chunky bubble pop with pitch variety */
  crazy(n = 0) {
    const size = 0.55 + (n % 7) * 0.08;
    bubblePop(size);
    // occasional double-pop for variety
    if (n % 3 === 0) bubblePop(0.4 + (n % 5) * 0.05, 0.08);
    const base = 320 + (n % 12) * 35;
    tone(base * 1.8, 0.1, 'sine', 0.04, 0.04);
  },
  boing() {
    bubblePop(0.65);
    tone(200, 0.08, 'sine', 0.07);
    tone(500, 0.15, 'triangle', 0.06, 0.05);
    tone(800, 0.1, 'sine', 0.04, 0.12);
  },
  whoosh() {
    if (muted) return;
    const a = ac();
    const t = a.currentTime;
    // airy whoosh with a pop at the end
    noiseBurst(0.22, 0.08, 0, 400, 0.6);
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1000, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + 0.28);
    bubblePop(0.55, 0.18);
  },
  fanfare() {
    bubblePop(1.0);
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, 0.04 + i * 0.06));
  },
};

/** Soft looping pentatonic lullaby bed */
export function startMusic() {
  if (muted || musicOn) return;
  const a = ac();
  musicOn = true;

  const master = a.createGain();
  master.gain.value = 0.045;
  master.connect(a.destination);

  const scale = [262, 294, 330, 392, 440, 523, 587, 659];
  let step = 0;

  function beat() {
    if (!musicOn) return;
    const f = scale[step % scale.length];
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = a.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.6);
    // soft fifth
    const o2 = a.createOscillator();
    const g2 = a.createGain();
    o2.type = 'triangle';
    o2.frequency.value = f * 1.5;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o2.connect(g2);
    g2.connect(master);
    o2.start(t);
    o2.stop(t + 0.55);
    step = (step + (Math.random() > 0.3 ? 1 : 2)) % scale.length;
    musicNodes = setTimeout(beat, 480 + Math.random() * 80);
  }
  beat();
}

export function stopMusic() {
  musicOn = false;
  if (musicNodes) clearTimeout(musicNodes);
  musicNodes = null;
}
