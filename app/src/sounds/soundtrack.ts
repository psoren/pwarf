import * as Tone from "tone";

/**
 * Procedural ambient soundtrack using Tone.js.
 *
 * Generates a looping generative ambient track with:
 * - A low drone pad (two detuned oscillators)
 * - A slow pentatonic arpeggio that picks random notes
 *
 * All sounds are synthesized — no audio files needed.
 */

const PENTATONIC_NOTES = [
  "C3", "D3", "E3", "G3", "A3",
  "C4", "D4", "E4", "G4", "A4",
] as const;

/** Volume levels (dB) */
const DRONE_VOLUME = -22;
const ARPEGGIO_VOLUME = -18;
const MASTER_VOLUME = -6;

let initialized = false;
let drone: Tone.PolySynth | null = null;
let arpSynth: Tone.Synth | null = null;
let arpLoop: Tone.Loop | null = null;
let masterGain: Tone.Gain | null = null;

function ensureInit(): void {
  if (initialized) return;
  initialized = true;

  masterGain = new Tone.Gain(Tone.dbToGain(MASTER_VOLUME)).toDestination();

  // --- Drone pad: two slightly detuned notes held indefinitely ---
  drone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 4 },
    volume: DRONE_VOLUME,
  }).connect(masterGain);

  // --- Arpeggio: gentle pluck picking pentatonic notes ---
  arpSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 1.5, sustain: 0, release: 0.8 },
    volume: ARPEGGIO_VOLUME,
  }).connect(masterGain);

  arpLoop = new Tone.Loop((time) => {
    const note = PENTATONIC_NOTES[Math.floor(Math.random() * PENTATONIC_NOTES.length)];
    arpSynth!.triggerAttackRelease(note, "4n", time);
  }, "2n");
}

export function startSoundtrack(): void {
  ensureInit();
  if (Tone.getTransport().state === "started") return;

  drone!.triggerAttack(["C2", "G2"]);
  arpLoop!.start(0);
  Tone.getTransport().start();
}

export function stopSoundtrack(): void {
  if (!initialized) return;
  Tone.getTransport().stop();
  arpLoop?.stop();
  drone?.releaseAll();
}

export function pauseSoundtrack(): void {
  if (!initialized) return;
  Tone.getTransport().pause();
}

export function resumeSoundtrack(): void {
  if (!initialized || Tone.getTransport().state === "started") return;
  Tone.getTransport().start();
}

export function setSoundtrackMuted(muted: boolean): void {
  if (!masterGain) return;
  masterGain.gain.rampTo(muted ? 0 : Tone.dbToGain(MASTER_VOLUME), 0.3);
}

export function disposeSoundtrack(): void {
  if (!initialized) return;
  stopSoundtrack();
  arpLoop?.dispose();
  arpSynth?.dispose();
  drone?.dispose();
  masterGain?.dispose();
  arpLoop = null;
  arpSynth = null;
  drone = null;
  masterGain = null;
  initialized = false;
}
