"use client";

import { createStore } from "./store";

/**
 * The story's soundtrack, synthesised in the browser with the Web Audio API: no audio files.
 * Two generative tracks ("drift": slow pads and bells; "pulse": a quiet beat), plus two one-shot
 * sounds the story plays itself. This file is the contract the dock, the entry screen and the
 * story share.
 *
 * Sound comes out only when three things are true: the story is on screen (`setSoundAllowed`),
 * the visitor has not switched it off (`setSoundEnabled`), and the browser has seen a user
 * gesture (its autoplay rule). Until the third is true the engine waits for the next gesture.
 */

export type TrackId = "drift" | "pulse";
export const TRACKS: TrackId[] = ["drift", "pulse"];

function stored(key: string): string | null {
  // This module is also loaded on the server, where recent versions of Node have a
  // `localStorage` of their own that warns when it is touched: ask for the browser first.
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: fall back to the defaults
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice then lasts for this visit only.
  }
}

const isTrack = (value: unknown): value is TrackId => TRACKS.includes(value as TrackId);

/** What the visitor asked for (remembered between visits). */
export const soundEnabled = createStore(stored("sound") !== "off");
/** Whether sound is actually coming out right now. */
export const soundPlaying = createStore(false);
export const soundTrack = createStore<TrackId>(((saved) => (isTrack(saved) ? saved : "drift"))(stored("track")));

/* ── The mixer ───────────────────────────────────────────────────────────────────────────── */

type Mixer = {
  context: AudioContext;
  /** Overall volume: eased up when sound starts, down when it stops. */
  master: GainNode;
  /** Everything tonal goes in here: a low-pass filter (the "mood"), then dry and reverb. */
  tone: BiquadFilterNode;
  /** An echo, timed by the running track, that feeds back into `tone`. */
  echo: DelayNode;
  /** Kick and hat skip the filter and the reverb, so they stay tight. */
  drums: GainNode;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
};

const VOLUME = 0.3;
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let mixer: Mixer | null = null;
let allowed = false;
let mood = 0.5;
let stopTrack: (() => void) | null = null;
/** Counts start attempts, so a slow `resume()` that has been overtaken does nothing when it lands. */
let attempt = 0;
let waitingForGesture = false;

/** White noise, `seconds` long; `fade` makes it die away (a reverb tail) instead of staying level. */
function noise(context: AudioContext, seconds: number, channels = 1, fade = 0): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(channels, length, context.sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, fade);
  }
  return buffer;
}

function build(): Mixer | null {
  const Context =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;

  // iOS: play through the media channel, so the ring/silent switch does not mute the page.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";

  const context = new Context();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const bus = context.createGain();
  bus.connect(master);

  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  bus.connect(analyser);

  const tone = context.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = cutoff(mood);
  tone.Q.value = 0.5;

  const dry = context.createGain();
  dry.gain.value = 0.62;
  tone.connect(dry).connect(bus);

  // The room: three and a half seconds of fading noise make a wide, soft reverb.
  const room = context.createConvolver();
  const fillRoom = () => {
    room.buffer = noise(context, 3.5, 2, 2.6);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(fillRoom, { timeout: 1000 });
  else setTimeout(fillRoom, 50);
  const wet = context.createGain();
  wet.gain.value = 0.5;
  tone.connect(room).connect(wet).connect(bus);

  const echo = context.createDelay(2);
  echo.delayTime.value = 0.4;
  const feedback = context.createGain();
  feedback.gain.value = 0.36;
  const echoOut = context.createGain();
  echoOut.gain.value = 0.42;
  echo.connect(feedback).connect(echo);
  echo.connect(echoOut).connect(tone);

  const drums = context.createGain();
  drums.gain.value = 0.85;
  drums.connect(bus);

  return { context, master, tone, echo, drums, analyser, samples: new Uint8Array(analyser.fftSize) };
}

const cutoff = (value: number) => 550 + value * 2700;

/* ── Voices ──────────────────────────────────────────────────────────────────────────────── */

/** Long notes still sounding, so a track that stops can let go of them instead of leaving them ringing. */
const held = new Set<{ osc: OscillatorNode; gain: GainNode }>();

function releaseHeld(context: AudioContext) {
  const t = context.currentTime;
  held.forEach(({ osc, gain }) => {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0, t, 0.35);
    try {
      osc.stop(t + 2.5);
    } catch {
      // Older Safari refuses a second stop(): the note then ends at its own time, silently.
    }
  });
  held.clear();
}

/** A chord as a soft pad: two slightly detuned oscillators per note, swelling in and out. */
function pad({ context, tone }: Mixer, notes: number[], at: number, length: number, level: number) {
  const swell = Math.min(4, length / 3);
  for (const note of notes) {
    for (const [type, detune, gainLevel] of [
      ["sine", -5, level],
      ["triangle", 8, level * 0.45],
    ] as const) {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.value = hz(note);
      osc.detune.value = detune;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(gainLevel, at + swell);
      gain.gain.setValueAtTime(gainLevel, at + length - swell);
      gain.gain.linearRampToValueAtTime(0, at + length + 2);
      osc.connect(gain).connect(tone);
      osc.start(at);
      osc.stop(at + length + 2.5);
      const voice = { osc, gain };
      held.add(voice);
      osc.onended = () => held.delete(voice);
    }
  }
}

type Pluck = { level?: number; decay?: number; type?: OscillatorType; into?: AudioNode };

/** A struck note: instant attack, exponential tail. */
function pluck({ context, tone }: Mixer, frequency: number, at: number, options: Pluck = {}) {
  const { level = 0.05, decay = 2.2, type = "sine", into = tone } = options;
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(gain).connect(into);
  osc.start(at);
  osc.stop(at + decay + 0.1);
}

function kick({ context, drums }: Mixer, at: number, level: number) {
  const osc = context.createOscillator();
  osc.frequency.setValueAtTime(112, at);
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.16);
  const gain = context.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
  osc.connect(gain).connect(drums);
  osc.start(at);
  osc.stop(at + 0.5);
}

let hiss: AudioBuffer | null = null;

function hat({ context, drums }: Mixer, at: number, level: number) {
  if (!hiss || hiss.sampleRate !== context.sampleRate) hiss = noise(context, 0.06);
  const source = context.createBufferSource();
  source.buffer = hiss;
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7400;
  const gain = context.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  source.connect(filter).connect(gain).connect(drums);
  source.start(at);
}

/* ── The two tracks ──────────────────────────────────────────────────────────────────────── */

/** Notes are MIDI numbers. Both tracks stay in modes that have no leading tone: nothing resolves, so nothing ends. */

/** Drift, in E dorian: Em9, Aadd9 over E, Gmaj9, Bm11. */
const DRIFT_CHORDS = [
  [40, 47, 55, 62, 66],
  [45, 52, 59, 61, 64],
  [43, 50, 59, 66, 69],
  [47, 54, 57, 62, 64],
];
/** The bells above them: E, F sharp, A, B and D. No third, so every one of them sits over all four chords. */
const BELLS = [76, 78, 81, 83, 86, 88, 90, 93].map(hz);

/**
 * Timers keep running while the tab is hidden but the audio clock does not, so both tracks
 * schedule against the audio clock: nothing piles up to play at once when the tab comes back.
 */
function drift(m: Mixer): () => void {
  const { context, tone } = m;
  const every = 9;
  let chord = 0;
  let nextChord = context.currentTime + 0.05;
  let nextBell = context.currentTime + 2.5;

  const timer = setInterval(() => {
    const t = context.currentTime;
    if (t + 0.3 >= nextChord) {
      pad(m, DRIFT_CHORDS[chord], nextChord, every + 2.5, 0.05);
      chord = (chord + 1) % DRIFT_CHORDS.length;
      nextChord += every;
    }
    if (t >= nextBell) {
      pluck(m, BELLS[Math.floor(Math.random() * BELLS.length)], t, { level: 0.028 + mood * 0.032, decay: 2.6 });
      // Brighter chapters ring more often.
      nextBell = t + 1.3 + Math.random() * (4.4 - mood * 2.5);
    }
  }, 200);

  // A low E under everything, breathing slowly.
  const drone = context.createOscillator();
  drone.frequency.value = hz(28);
  const overtone = context.createOscillator();
  overtone.frequency.value = hz(40);
  const overtoneLevel = context.createGain();
  overtoneLevel.gain.value = 0.3;
  const level = context.createGain();
  level.gain.setValueAtTime(0, context.currentTime);
  level.gain.linearRampToValueAtTime(0.085, context.currentTime + 3.5);
  const tremolo = context.createOscillator();
  tremolo.frequency.value = 0.06;
  const depth = context.createGain();
  depth.gain.value = 0.04;
  tremolo.connect(depth).connect(level.gain);
  drone.connect(level);
  overtone.connect(overtoneLevel).connect(level);
  level.connect(tone);
  for (const osc of [drone, overtone, tremolo]) osc.start();

  return () => {
    clearInterval(timer);
    const t = context.currentTime;
    level.gain.cancelScheduledValues(t);
    level.gain.setTargetAtTime(0, t, 0.5);
    for (const osc of [drone, overtone, tremolo]) osc.stop(t + 3);
    releaseHeld(context);
  };
}

/** Pulse, in F sharp minor at 92 beats a minute: F#m9, Dmaj7, E6/9, C#m7, two bars each. */
const PULSE = {
  bpm: 92,
  chords: [
    { root: 30, notes: [54, 57, 61, 64, 68] },
    { root: 26, notes: [50, 57, 61, 66, 69] },
    { root: 28, notes: [52, 56, 59, 61, 66] },
    { root: 25, notes: [49, 56, 59, 64, 68] },
  ],
  /** Sixteenth-note steps of the bar (0 to 15) each part plays on. */
  kick: [0, 7, 10],
  hat: [2, 6, 10, 13, 14],
  bass: [0, 3, 8, 11, 14],
  /** Which chord note the arpeggio takes on each eighth. */
  arp: [0, 3, 1, 4, 2, 4, 1, 3],
};

function pulse(m: Mixer): () => void {
  const { context, echo } = m;
  const step = 60 / PULSE.bpm / 4;
  // A dotted-eighth echo: repeats land between the arpeggio's notes.
  echo.delayTime.value = step * 3;
  let index = 0;
  let at = context.currentTime + 0.1;

  const schedule = () => {
    while (at < context.currentTime + 0.15) {
      const bar = Math.floor(index / 16);
      const beat = index % 16;
      const chord = PULSE.chords[Math.floor(bar / 2) % PULSE.chords.length];

      if (beat === 0 && bar % 2 === 0) pad(m, chord.notes, at, step * 32 - 1, 0.034);
      if (PULSE.kick.includes(beat)) kick(m, at, beat === 0 ? 0.32 : 0.2);
      if (PULSE.hat.includes(beat)) hat(m, at, (beat === 13 ? 0.006 : 0.011) + mood * 0.02);
      if (PULSE.bass.includes(beat)) {
        pluck(m, hz(chord.root + (beat === 11 ? 12 : 0) + 12), at, { level: 0.1, decay: 0.48, type: "triangle" });
      }
      // Calm chapters get the arpeggio on the beat only; brighter ones on every eighth.
      if (beat % 2 === 0 && (mood > 0.4 || beat % 4 === 0)) {
        const note = hz(chord.notes[PULSE.arp[(beat / 2) % PULSE.arp.length]] + 12);
        pluck(m, note, at, { level: 0.034, decay: 0.34, type: "triangle", into: echo });
        pluck(m, note, at, { level: 0.02, decay: 0.3 });
      }
      at += step;
      index++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 25);

  return () => {
    clearInterval(timer);
    releaseHeld(context);
  };
}

const tracks: Record<TrackId, (mixer: Mixer) => () => void> = { drift, pulse };

/* ── Starting and stopping ───────────────────────────────────────────────────────────────── */

const GESTURES = ["pointerdown", "keydown", "touchend"] as const;

function onGesture(event: Event) {
  // The on/off switches answer their own click. Starting here as well would have the same
  // press turn the sound on (this listener) and straight off again (the switch).
  if (event.target instanceof Element && event.target.closest("[data-sound-control]")) return;
  forgetGesture();
  void start();
}

/** Autoplay rules: without a gesture the context would stay suspended, so try again on the next one. */
function waitForGesture() {
  if (waitingForGesture) return;
  waitingForGesture = true;
  for (const type of GESTURES) window.addEventListener(type, onGesture, { capture: true, passive: true });
}

function forgetGesture() {
  if (!waitingForGesture) return;
  waitingForGesture = false;
  for (const type of GESTURES) window.removeEventListener(type, onGesture, { capture: true });
}

async function start() {
  if (typeof window === "undefined" || !allowed || !soundEnabled.get() || soundPlaying.get()) return;
  const mine = ++attempt;
  window.clearTimeout(rest);
  try {
    if (!mixer) {
      // Creating a context before any gesture only earns a console warning: wait instead.
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return waitForGesture();
      mixer = build();
      if (!mixer) return;
    }
    const { context, master } = mixer;
    if (context.state !== "running") {
      // If this call is not inside a gesture, `resume()` stays pending until one happens.
      waitForGesture();
      const resumed = context.resume();
      // iOS only unlocks audio once a buffer has been started from inside a gesture.
      const silence = context.createBufferSource();
      silence.buffer = context.createBuffer(1, 1, context.sampleRate);
      silence.connect(context.destination);
      silence.start(0);
      await resumed;
    }
    if (mine !== attempt || !allowed || !soundEnabled.get() || soundPlaying.get()) return;
    if (context.state !== "running" || document.hidden) return;
    forgetGesture();
    soundPlaying.set(true);
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(VOLUME, context.currentTime, 1.2);
    stopTrack = tracks[soundTrack.get()](mixer);
  } catch {
    // No sound is never a reason to break the page.
  }
}

/** How long after the sound stops the audio thread is put to sleep: the fade and the last notes fit inside it. */
const REST_AFTER_MS = 4000;
let rest = 0;

function stop() {
  attempt++;
  forgetGesture();
  if (!mixer) return;
  // Silence still costs a running audio thread: let it sleep until sound is wanted again.
  window.clearTimeout(rest);
  rest = window.setTimeout(() => {
    if (mixer && !soundPlaying.get()) void mixer.context.suspend().catch(() => {});
  }, REST_AFTER_MS);
  if (!soundPlaying.get()) return;
  soundPlaying.set(false);
  try {
    stopTrack?.();
    mixer.master.gain.cancelScheduledValues(mixer.context.currentTime);
    mixer.master.gain.setTargetAtTime(0, mixer.context.currentTime, 0.4);
  } catch {
    // See above.
  }
  stopTrack = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!mixer) return;
    if (document.hidden) void mixer.context.suspend().catch(() => {});
    else if (soundPlaying.get()) void mixer.context.resume().catch(() => {});
    else void start();
  });
}

/* ── The contract ────────────────────────────────────────────────────────────────────────── */

/** Turn the sound on or off. Must be called from a user gesture the first time. */
export function setSoundEnabled(on: boolean): void {
  soundEnabled.set(on);
  store("sound", on ? "on" : "off");
  if (on) void start();
  else stop();
}

/** Only the story plays sound: the app calls this with `true` on the way in and `false` on the way out. */
export function setSoundAllowed(value: boolean): void {
  allowed = value;
  if (value) void start();
  else stop();
}

export function setTrack(id: TrackId): void {
  if (!isTrack(id) || id === soundTrack.get()) return;
  soundTrack.set(id);
  store("track", id);
  if (!mixer || !soundPlaying.get()) return;
  try {
    stopTrack?.();
    stopTrack = tracks[id](mixer);
  } catch {
    stopTrack = null;
  }
}

/** How loud the music is right now, 0 to 1 (read every frame by the story's dots). */
export function audioLevel(): number {
  if (!mixer || !soundPlaying.get()) return 0;
  const { analyser, samples } = mixer;
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = (samples[i] - 128) / 128;
    sum += value * value;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3.3);
}

/** How bright the music is, 0 (muffled) to 1 (open): each chapter sets its own. */
export function setMood(value: number): void {
  mood = Math.min(1, Math.max(0, value));
  if (!mixer) return;
  try {
    mixer.tone.frequency.setTargetAtTime(cutoff(mood), mixer.context.currentTime, 1.5);
  } catch {
    // See above.
  }
}

/** A single soft note (hovering something in the story). */
export function ping(frequency: number = BELLS[Math.floor(Math.random() * BELLS.length)], level = 0.05): void {
  if (!mixer || !soundPlaying.get()) return;
  try {
    pluck(mixer, frequency, mixer.context.currentTime, { level });
  } catch {
    // See above.
  }
}

/** A filtered-noise swell (changing chapter). */
export function whoosh(level = 0.12): void {
  if (!mixer || !soundPlaying.get()) return;
  try {
    const { context, tone } = mixer;
    const t = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise(context, 1.7);
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(220, t);
    band.frequency.exponentialRampToValueAtTime(2400, t + 0.75);
    band.frequency.exponentialRampToValueAtTime(360, t + 1.6);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.55);
    gain.gain.linearRampToValueAtTime(0, t + 1.6);
    source.connect(band).connect(gain).connect(tone);
    source.start(t);
    source.stop(t + 1.7);
  } catch {
    // See above.
  }
}
