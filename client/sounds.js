// Sound effects using Web Audio API — no files needed, works in all browsers

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function playCardSound() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function playTurnSound() {
  try {
    const ctx = getCtx();
    [523, 659, 784].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.15);
      o.start(ctx.currentTime + i * 0.1);
      o.stop(ctx.currentTime + i * 0.1 + 0.15);
    });
  } catch {}
}

export function playWinSound() {
  try {
    const ctx = getCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {}
}

export function playErrorSound() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.2);
  } catch {}
}

export function playTimerWarningSound() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'square';
    o.frequency.value = 400;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.08);
  } catch {}
}

export function playClapSound() {
  try {
    const ctx = getCtx();
    // Handclap: burst of noise-like tones
    const times = [0, 0.15, 0.3, 0.45, 0.6];
    times.forEach(t => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime + t);
      g.gain.setValueAtTime(0.1, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.08);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.08);
    });
  } catch {}
}

export function playLoserSound() {
  try {
    const ctx = getCtx();
    // Sad descending tone: wah-wah-wah
    const notes = [400, 350, 250];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sawtooth';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.25 + 0.2);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 0.2);
    });
  } catch {}
}
