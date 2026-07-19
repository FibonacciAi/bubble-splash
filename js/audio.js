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

export const sfx = {
  unlock() { ac(); },
  pop() {
    tone(520, 0.12, 'triangle', 0.07);
    tone(780, 0.1, 'sine', 0.05, 0.04);
  },
  collect() {
    tone(660, 0.1, 'sine', 0.08);
    tone(880, 0.12, 'triangle', 0.07, 0.06);
    tone(1175, 0.15, 'sine', 0.05, 0.12);
  },
  magic() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 0.18, 'sine', 0.06, i * 0.05));
  },
  cheer() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.07));
  },
  start() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, 'sine', 0.07, i * 0.08));
  },
  meow() {
    // soft high → low “mew”
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
    tone(600, 0.1, 'sine', 0.06);
    tone(800, 0.1, 'triangle', 0.05, 0.08);
    tone(500, 0.12, 'sine', 0.05, 0.16);
  },
  /** Random fun blip based on which key-ish number */
  crazy(n = 0) {
    const base = 300 + (n % 12) * 40;
    tone(base, 0.1, 'sine', 0.07);
    tone(base * 1.5, 0.12, 'triangle', 0.05, 0.05);
    tone(base * 2, 0.1, 'square', 0.03, 0.1);
  },
  boing() {
    tone(200, 0.08, 'sine', 0.07);
    tone(500, 0.15, 'triangle', 0.06, 0.05);
    tone(800, 0.1, 'sine', 0.04, 0.12);
  },
  whoosh() {
    tone(900, 0.2, 'sawtooth', 0.03, 0);
    // descending
    const a = ac();
    if (muted) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1000, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(120, a.currentTime + 0.25);
    g.gain.setValueAtTime(0.06, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25);
    o.connect(g);
    g.connect(a.destination);
    o.start();
    o.stop(a.currentTime + 0.28);
  },
  fanfare() {
    [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.06));
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
