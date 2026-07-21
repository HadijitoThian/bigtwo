// Procedural lo-fi jazz music generator using Web Audio API.
// Plays a slow ii-V-I progression in F major with a walking bass and soft chord voicings.
// Zero-dependency, no audio file needed — always works, tiny footprint.

let ctx = null;
let master = null;
let running = false;
let stopFn = null;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.18;
    // Warm low-pass so it doesn't feel harsh
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.5;
    master.connect(lp);
    lp.connect(ctx.destination);
  }
  return ctx;
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// Soft piano-like tone: two detuned sine oscillators + envelope
function playNote(midi, when, dur, vel = 0.5) {
  const c = ctx;
  const g = c.createGain();
  const freq = midiToFreq(midi);

  const o1 = c.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;

  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq * 1.005; // subtle detune for warmth

  const mix = c.createGain();
  mix.gain.value = 0.5;
  o1.connect(mix);
  o2.connect(mix);
  mix.connect(g);
  g.connect(master);

  // Fast attack, slow release — piano-ish
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  o1.start(when);
  o2.start(when);
  o1.stop(when + dur + 0.05);
  o2.stop(when + dur + 0.05);
}

// Upright bass — sine with more body, gentle decay
function playBass(midi, when, dur, vel = 0.55) {
  const c = ctx;
  const g = c.createGain();
  const freq = midiToFreq(midi);

  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;

  // Slight pitch wobble at attack (upright bass "thump")
  o.frequency.setValueAtTime(freq * 1.02, when);
  o.frequency.exponentialRampToValueAtTime(freq, when + 0.05);

  o.connect(g);
  g.connect(master);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  o.start(when);
  o.stop(when + dur + 0.05);
}

// Soft hi-hat: filtered noise burst
function playHat(when, vel = 0.06) {
  const c = ctx;
  const bufSize = c.sampleRate * 0.05;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(vel, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
  src.connect(hp);
  hp.connect(g);
  g.connect(master);
  src.start(when);
  src.stop(when + 0.06);
}

// ii-V-I-VI in F: Gm7 - C7 - FMaj7 - Dm7 (with a IV substitution feel)
// Chord voicings expressed as MIDI notes above middle bass root
const PROGRESSION = [
  { root: 43, chord: [58, 62, 65, 69], bass: [43, 45, 47, 50] }, // Gm7:  G Bb D F
  { root: 36, chord: [55, 60, 64, 67], bass: [36, 38, 40, 43] }, // C7:   C E G Bb (approx)
  { root: 41, chord: [57, 60, 65, 69], bass: [41, 43, 45, 48] }, // FMaj7: F A C E
  { root: 38, chord: [57, 60, 65, 69], bass: [38, 40, 41, 43] }, // Dm7:  D F A C
];

const BEAT = 0.55; // seconds per beat (~109 BPM, mellow)
const BEATS_PER_BAR = 4;

function scheduleBar(barStart, chordIdx) {
  const { chord, bass } = PROGRESSION[chordIdx % PROGRESSION.length];

  // Chord: play once at start of bar, held for ~2 beats, gentle re-hit at beat 3
  chord.forEach((n, i) => {
    // Slight arpeggio stagger for humanization
    playNote(n, barStart + i * 0.02, BEAT * 2.2, 0.10 + Math.random() * 0.02);
    playNote(n, barStart + BEAT * 2 + i * 0.02, BEAT * 1.8, 0.08 + Math.random() * 0.02);
  });

  // Walking bass — one note per beat
  for (let b = 0; b < BEATS_PER_BAR; b++) {
    playBass(bass[b], barStart + b * BEAT, BEAT * 0.9, 0.35);
  }

  // Hi-hat on beats 2 and 4 (jazz swing accent)
  playHat(barStart + BEAT * 1, 0.05);
  playHat(barStart + BEAT * 3, 0.05);
  // Ghost hats on off-beats for shuffle feel
  playHat(barStart + BEAT * 1.66, 0.025);
  playHat(barStart + BEAT * 3.66, 0.025);
}

export function startJazz() {
  if (running) return;
  ensureCtx();
  if (ctx.state === 'suspended') ctx.resume();
  running = true;

  let barIdx = 0;
  let nextBarTime = ctx.currentTime + 0.1;

  // Schedule ahead in a rolling window
  const tick = () => {
    if (!running) return;
    while (nextBarTime < ctx.currentTime + 1.5) {
      scheduleBar(nextBarTime, barIdx);
      nextBarTime += BEAT * BEATS_PER_BAR;
      barIdx++;
    }
  };
  tick();
  const interval = setInterval(tick, 250);
  stopFn = () => { clearInterval(interval); };
}

export function stopJazz() {
  running = false;
  if (stopFn) { stopFn(); stopFn = null; }
  if (master) {
    // Fade out to avoid click
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    setTimeout(() => { if (!running && master) master.gain.value = 0.18; }, 400);
  }
}

export function setJazzVolume(vol) {
  if (master) master.gain.value = vol;
}

export function isJazzRunning() { return running; }
