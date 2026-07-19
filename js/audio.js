/**
 * Bubble Splash audio — chunky wet pops, dolphin peeps, undersea music bed.
 * All synthesized (no samples). Master bus + light compression for punch.
 */

let actx = null;
let muted = false;
let musicTimer = null;
let musicOn = false;
let master = null;
let comp = null;
let wet = null; // soft high shelf for sparkle

function ac() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    // Master chain: SFX/music → compressor → high shelf → out
    master = actx.createGain();
    master.gain.value = 0.85;

    comp = actx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;

    wet = actx.createBiquadFilter();
    wet.type = 'highshelf';
    wet.frequency.value = 2800;
    wet.gain.value = 1.5; // soft water clarity — not metallic sparkle

    master.connect(comp);
    comp.connect(wet);
    wet.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function bus() {
  ac();
  return master;
}

function tone(freq, dur, type = 'sine', gain = 0.08, when = 0, slideTo = null) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(bus());
  o.start(t0);
  o.stop(t0 + dur + 0.04);
}

/** Pink-ish noise buffer (cached). */
let noiseCache = null;
function noiseBuffer() {
  const a = ac();
  if (noiseCache && noiseCache.sampleRate === a.sampleRate) return noiseCache;
  const len = a.sampleRate * 1.5;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    // Paul Kellet approx pink
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  noiseCache = buf;
  return buf;
}

/**
 * Shaped noise through filters.
 * kind: 'snap' | 'whoosh' | 'fizz' | 'gurgle'
 */
function noiseShaped(opts = {}) {
  if (muted) return;
  const {
    dur = 0.12,
    gain = 0.14,
    when = 0,
    kind = 'snap',
    f0 = 900,
    f1 = null,
  } = opts;
  const a = ac();
  const t0 = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;

  const hp = a.createBiquadFilter();
  const bp = a.createBiquadFilter();
  const g = a.createGain();

  if (kind === 'snap') {
    hp.type = 'highpass';
    hp.frequency.value = 400;
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f0, t0);
    if (f1) bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    bp.Q.value = 1.4;
  } else if (kind === 'whoosh') {
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(200, t0);
    hp.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(2800, t0);
    bp.frequency.exponentialRampToValueAtTime(600, t0 + dur);
    bp.Q.value = 0.7;
  } else if (kind === 'fizz') {
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    bp.type = 'bandpass';
    bp.frequency.value = f0 || 4500;
    bp.Q.value = 0.6;
  } else {
    // gurgle
    hp.type = 'lowpass';
    hp.frequency.setValueAtTime(800, t0);
    hp.frequency.exponentialRampToValueAtTime(200, t0 + dur);
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f0 || 280, t0);
    bp.frequency.exponentialRampToValueAtTime(f1 || 90, t0 + dur);
    bp.Q.value = 2.5;
  }

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  // snappy tail
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(bus());
  src.start(t0);
  src.stop(t0 + dur + 0.03);
}

/**
 * Physicy bubble: Helmholtz-ish resonance + wet skin snap + sub.
 * @param {number} size 0.2–1.3
 */
function bubblePop(size = 0.8, when = 0) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + when;
  const s = Math.max(0.2, Math.min(1.35, size));
  // tiny randomize so mash never sounds identical
  const jitter = 0.92 + Math.random() * 0.16;

  // --- A: resonant “hollow” sine with fast pitch dive (main character) ---
  const body = a.createOscillator();
  const bodyG = a.createGain();
  const bodyF = a.createBiquadFilter();
  body.type = 'sine';
  const startF = (220 + s * 480) * jitter; // ~220–850
  const endF = (48 + s * 55) * jitter;
  body.frequency.setValueAtTime(startF, t0);
  body.frequency.exponentialRampToValueAtTime(Math.max(30, endF), t0 + 0.09 + s * 0.08);
  bodyF.type = 'lowpass';
  bodyF.frequency.setValueAtTime(startF * 2.2, t0);
  bodyF.frequency.exponentialRampToValueAtTime(endF * 3, t0 + 0.15);
  bodyG.gain.setValueAtTime(0.0001, t0);
  bodyG.gain.exponentialRampToValueAtTime(0.22 + s * 0.14, t0 + 0.006);
  bodyG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16 + s * 0.12);
  body.connect(bodyF);
  bodyF.connect(bodyG);
  bodyG.connect(bus());
  body.start(t0);
  body.stop(t0 + 0.4);

  // --- B: detuned twin for thickness ---
  const twin = a.createOscillator();
  const twinG = a.createGain();
  twin.type = 'sine';
  twin.frequency.setValueAtTime(startF * 1.01, t0);
  twin.frequency.exponentialRampToValueAtTime(Math.max(30, endF * 1.04), t0 + 0.1 + s * 0.08);
  twinG.gain.setValueAtTime(0.0001, t0);
  twinG.gain.exponentialRampToValueAtTime(0.1 + s * 0.06, t0 + 0.008);
  twinG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14 + s * 0.1);
  twin.connect(twinG);
  twinG.connect(bus());
  twin.start(t0);
  twin.stop(t0 + 0.35);

  // --- C: triangle overtone “skin” (the wet lip) ---
  const skin = a.createOscillator();
  const skinG = a.createGain();
  skin.type = 'triangle';
  skin.frequency.setValueAtTime(startF * 1.7, t0);
  skin.frequency.exponentialRampToValueAtTime(endF * 2.2, t0 + 0.07);
  skinG.gain.setValueAtTime(0.0001, t0);
  skinG.gain.exponentialRampToValueAtTime(0.07 + s * 0.04, t0 + 0.004);
  skinG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  skin.connect(skinG);
  skinG.connect(bus());
  skin.start(t0);
  skin.stop(t0 + 0.15);

  // --- D: sub boom (size feels real) ---
  const sub = a.createOscillator();
  const subG = a.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70 + s * 55, t0);
  sub.frequency.exponentialRampToValueAtTime(36, t0 + 0.14);
  subG.gain.setValueAtTime(0.0001, t0);
  subG.gain.exponentialRampToValueAtTime(0.16 + s * 0.12, t0 + 0.005);
  subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  sub.connect(subG);
  subG.connect(bus());
  sub.start(t0);
  sub.stop(t0 + 0.22);

  // --- E: wet noise SNAP (the pop itself) ---
  noiseShaped({
    dur: 0.05 + s * 0.05,
    gain: 0.16 + s * 0.1,
    when,
    kind: 'snap',
    f0: 1100 + s * 900,
    f1: 350 + s * 200,
  });

  // --- F: airy fizz afterglow ---
  noiseShaped({
    dur: 0.1 + s * 0.08,
    gain: 0.04 + s * 0.03,
    when: when + 0.02,
    kind: 'fizz',
    f0: 5000 + s * 2000,
  });

  // --- G: soft air “plink” (water drop, not coin) ---
  const ping = a.createOscillator();
  const pingG = a.createGain();
  ping.type = 'sine';
  ping.frequency.setValueAtTime(620 + s * 280 + Math.random() * 80, t0 + 0.012);
  ping.frequency.exponentialRampToValueAtTime(180 + s * 60, t0 + 0.1);
  pingG.gain.setValueAtTime(0.0001, t0 + 0.012);
  pingG.gain.exponentialRampToValueAtTime(0.035 + s * 0.02, t0 + 0.02);
  pingG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  ping.connect(pingG);
  pingG.connect(bus());
  ping.start(t0 + 0.012);
  ping.stop(t0 + 0.15);
}

/** Soft underwater gurgle bed accent */
function gurgle(when = 0, gain = 0.05) {
  noiseShaped({
    dur: 0.35,
    gain,
    when,
    kind: 'gurgle',
    f0: 320 + Math.random() * 180,
    f1: 80 + Math.random() * 40,
  });
  tone(180 + Math.random() * 80, 0.28, 'sine', gain * 0.8, when, 70);
}

/** Happy dolphin “eee-eee” peep */
function dolphinPeep() {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime;
  // rising whistle
  const o = a.createOscillator();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  o.type = 'sine';
  o.frequency.setValueAtTime(680, t0);
  o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.09);
  o.frequency.exponentialRampToValueAtTime(900, t0 + 0.18);
  f.type = 'bandpass';
  f.frequency.value = 1200;
  f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  o.connect(f);
  f.connect(g);
  g.connect(bus());
  o.start(t0);
  o.stop(t0 + 0.25);

  // second chirp
  const o2 = a.createOscillator();
  const g2 = a.createGain();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(900, t0 + 0.12);
  o2.frequency.exponentialRampToValueAtTime(1500, t0 + 0.2);
  o2.frequency.exponentialRampToValueAtTime(700, t0 + 0.3);
  g2.gain.setValueAtTime(0.0001, t0 + 0.12);
  g2.gain.exponentialRampToValueAtTime(0.07, t0 + 0.14);
  g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  o2.connect(g2);
  g2.connect(bus());
  o2.start(t0 + 0.12);
  o2.stop(t0 + 0.35);
}

/** Soft wave wash — no melody, just water moving */
function waveWash(when = 0, gain = 0.08) {
  noiseShaped({ dur: 0.32, gain, when, kind: 'whoosh' });
  noiseShaped({
    dur: 0.28,
    gain: gain * 0.6,
    when: when + 0.04,
    kind: 'gurgle',
    f0: 260 + Math.random() * 100,
    f1: 70,
  });
}

/** Cluster of wet pops (celebration without jackpot chimes) */
function splashCluster(when = 0) {
  const sizes = [0.9, 0.45, 0.7, 0.55, 1.0];
  sizes.forEach((s, i) => bubblePop(s * (0.9 + Math.random() * 0.15), when + i * 0.05));
  gurgle(when + 0.12, 0.055);
}

export const sfx = {
  unlock() { ac(); },

  pop() {
    bubblePop(0.55 + Math.random() * 0.15);
  },

  bigPop() {
    bubblePop(1.15);
    bubblePop(0.55, 0.055);
    bubblePop(0.35, 0.11);
  },

  bubbleParty() {
    // pure bubble bath — pops + gurgle only
    const sizes = [1.2, 0.55, 0.95, 0.4, 1.05, 0.65, 0.85, 0.5];
    sizes.forEach((s, i) => bubblePop(s, i * 0.055));
    gurgle(0.1, 0.07);
    gurgle(0.22, 0.05);
    waveWash(0.08, 0.07);
  },

  collect() {
    // grab = wet pop only (no coin jingle)
    bubblePop(0.5 + Math.random() * 0.28);
    if (Math.random() < 0.35) gurgle(0.04, 0.03);
  },

  magic() {
    bubblePop(0.8);
    bubblePop(0.5, 0.07);
    waveWash(0.02, 0.06);
  },

  cheer() {
    splashCluster(0);
    waveWash(0.08, 0.06);
  },

  start() {
    bubblePop(0.95);
    bubblePop(0.5, 0.08);
    waveWash(0.05, 0.07);
    dolphinPeep();
  },

  meow() {
    dolphinPeep();
  },

  purr() {
    // soft underwater hum / contented gurgle
    if (muted) return;
    const a = ac();
    const t0 = a.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(70 + i * 18, t0 + i * 0.04);
      o.frequency.linearRampToValueAtTime(55 + i * 12, t0 + 0.35);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + i * 0.04 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      o.connect(g);
      g.connect(bus());
      o.start(t0 + i * 0.04);
      o.stop(t0 + 0.45);
    }
    gurgle(0.05, 0.04);
  },

  play() {
    bubblePop(0.5);
    dolphinPeep();
  },

  crazy(n = 0) {
    // every mash = wet pop variety only — no jingles
    const size = 0.55 + (n % 9) * 0.08 + Math.random() * 0.08;
    bubblePop(size);
    if (n % 2 === 0) bubblePop(0.35 + (n % 5) * 0.06, 0.06);
    if (n % 5 === 0) gurgle(0.04, 0.045);
    if (n % 7 === 0) waveWash(0.02, 0.055);
  },

  boing() {
    // rubbery water bounce — deep body only
    if (muted) return;
    const a = ac();
    const t0 = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t0);
    o.frequency.exponentialRampToValueAtTime(380, t0 + 0.07);
    o.frequency.exponentialRampToValueAtTime(120, t0 + 0.22);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
    o.connect(g);
    g.connect(bus());
    o.start(t0);
    o.stop(t0 + 0.3);
    bubblePop(0.75, 0.04);
  },

  whoosh() {
    noiseShaped({ dur: 0.28, gain: 0.12, kind: 'whoosh' });
    tone(420, 0.22, 'sine', 0.04, 0, 80);
    bubblePop(0.65, 0.2);
  },

  fanfare() {
    // big splash moment — still all water, zero casino
    bubblePop(1.2);
    splashCluster(0.05);
    waveWash(0.1, 0.08);
    gurgle(0.18, 0.06);
  },
};

/** Undersea music: soft pad + plucky arps + occasional gurgles */
export function startMusic() {
  if (muted || musicOn) return;
  const a = ac();
  musicOn = true;

  const musGain = a.createGain();
  musGain.gain.value = 0.055;
  musGain.connect(bus());

  // gentle pad drone (two sines)
  const padNotes = [196, 247]; // G3 + B3-ish
  const padOsc = [];
  padNotes.forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.value = 0.35 - i * 0.08;
    o.connect(g);
    g.connect(musGain);
    o.start();
    padOsc.push(o);
  });

  // slow LFO on pad gain for “breathing water”
  const lfo = a.createOscillator();
  const lfoG = a.createGain();
  lfo.frequency.value = 0.12;
  lfoG.gain.value = 0.012;
  lfo.connect(lfoG);
  lfoG.connect(musGain.gain);
  lfo.start();

  const scale = [262, 294, 330, 392, 440, 523, 587, 659, 784];
  // pretty undersea motif steps
  const motif = [0, 2, 4, 2, 5, 4, 3, 1, 0, 4, 7, 5];
  let step = 0;

  function beat() {
    if (!musicOn) return;
    const t = a.currentTime;
    const idx = motif[step % motif.length];
    const f = scale[idx % scale.length];

    // pluck
    const o = a.createOscillator();
    const g = a.createGain();
    const flt = a.createBiquadFilter();
    o.type = 'sine';
    o.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1800, t);
    flt.frequency.exponentialRampToValueAtTime(600, t + 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(flt);
    flt.connect(g);
    g.connect(musGain);
    o.start(t);
    o.stop(t + 0.7);

    // soft fifth
    const o2 = a.createOscillator();
    const g2 = a.createGain();
    o2.type = 'triangle';
    o2.frequency.value = f * 1.5;
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.3, t + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o2.connect(g2);
    g2.connect(musGain);
    o2.start(t);
    o2.stop(t + 0.55);

    // rare ambient gurgle
    if (step % 7 === 3) gurgle(0, 0.035);
    // rare high bubble plink
    if (step % 11 === 5) bubblePop(0.3, 0.05);

    step += 1;
    musicTimer = setTimeout(beat, 420 + Math.random() * 100);
  }
  beat();

  // stash so stop can kill pad
  startMusic._pad = padOsc;
  startMusic._lfo = lfo;
  startMusic._musGain = musGain;
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) clearTimeout(musicTimer);
  musicTimer = null;
  try {
    startMusic._pad?.forEach((o) => o.stop());
    startMusic._lfo?.stop();
  } catch (_) {}
  startMusic._pad = null;
  startMusic._lfo = null;
}
