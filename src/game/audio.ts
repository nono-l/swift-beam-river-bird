/*
  効果音と、タイトルからゲームまで続く主題歌。
  画面が変わっても曲は止めない。消音のときだけ音量をゼロにする。
*/
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let muted = false;
let theme: HTMLAudioElement | null = null;

const THEME_URL = "/assets/theme.m4a";
const THEME_VOL = 0.55;

function ensureTheme(): HTMLAudioElement {
  if (theme) return theme;
  const el = new Audio(THEME_URL);
  el.loop = true;
  el.preload = "auto";
  el.volume = muted ? 0 : THEME_VOL;
  el.addEventListener("ended", () => {
    el.currentTime = 0;
    if (!muted) void el.play().catch(() => {});
  });
  theme = el;
  return el;
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.02);
  }
  if (theme) theme.volume = v ? 0 : THEME_VOL;
}

export function themeTime(): number {
  if (!theme || theme.paused) return -1;
  return theme.currentTime;
}

export function startTheme() {
  const el = ensureTheme();
  el.volume = muted ? 0 : THEME_VOL;
  if (!el.paused) return;
  void el.play().catch(() => {});
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    sfx.gain.value = 0.45;
    sfx.connect(master);
    master.connect(ctx.destination);
    master.gain.value = muted ? 0 : 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  startTheme();
}

function envGain(dur: number, peak: number) {
  if (!ctx || !sfx || muted) return null;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(sfx);
  return { g, t };
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, detune = 0) {
  if (!ctx) return;
  const e = envGain(dur, peak);
  if (!e) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.connect(e.g);
  o.start(e.t);
  o.stop(e.t + dur + 0.02);
}

function noise(dur: number, peak: number, hp = 400) {
  if (!ctx) return;
  const e = envGain(dur, peak);
  if (!e) return;
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.max(1, (ctx.sampleRate * dur) | 0), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  n.connect(f);
  f.connect(e.g);
  n.start(e.t);
  n.stop(e.t + dur);
}

export const sfxHit = () => {
  noise(0.06, 0.22, 800);
  tone(220 + Math.random() * 80, 0.07, "square", 0.08, (Math.random() - 0.5) * 40);
};

export const sfxPop = () => {
  noise(0.1, 0.28, 300);
  tone(520, 0.12, "triangle", 0.1);
};

export const sfxSummon = () => {
  tone(392, 0.12, "sine", 0.12);
  tone(523, 0.16, "sine", 0.1);
};

export const sfxMerge = () => {
  tone(523, 0.1, "triangle", 0.12);
  tone(659, 0.14, "triangle", 0.1);
  tone(784, 0.2, "sine", 0.08);
};

export const sfxCoin = () => tone(880 + Math.random() * 40, 0.08, "square", 0.07);

export const sfxFail = () => {
  tone(110, 0.4, "sawtooth", 0.12);
  tone(82, 0.55, "sine", 0.14);
};

export const sfxSelect = () => {
  tone(660, 0.1, "sine", 0.1);
  tone(990, 0.16, "sine", 0.08);
};

export const sfxBoss = () => {
  noise(0.18, 0.3, 120);
  tone(90, 0.22, "sawtooth", 0.12);
};

export function resumeIfNeeded() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}
