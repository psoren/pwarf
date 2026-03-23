import * as Tone from "tone";

export type SynthPresetName =
  | "pick_hit"
  | "rock_crumble"
  | "wall_placed"
  | "sword_clash"
  | "death_thud"
  | "tantrum_scream"
  | "item_smash"
  | "monster_roar"
  | "monster_die"
  | "stomach_growl"
  | "gulp"
  | "snore"
  | "stress_sting"
  | "artifact_fanfare"
  | "fortress_fallen"
  | "caravan_bells"
  | "disease_cough"
  | "year_chime"
  | "migration_crowd";

export type PlayFn = (options?: { pitch?: number }) => void;

export const PRESETS: Record<SynthPresetName, PlayFn> = {
  pick_hit({ pitch = 0 } = {}) {
    const synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -18,
    }).toDestination();
    const freq = 400 * Math.pow(2, pitch / 12);
    synth.frequency.value = freq;
    synth.triggerAttackRelease(freq, "8n");
    setTimeout(() => synth.dispose(), 500);
  },

  rock_crumble() {
    const synth = new Tone.NoiseSynth({
      noise: { type: "brown" },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -22,
    }).toDestination();
    synth.triggerAttackRelease("16n");
    setTimeout(() => synth.dispose(), 1000);
  },

  wall_placed() {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -16,
    }).toDestination();
    synth.triggerAttackRelease("C1", "8n");
    setTimeout(() => synth.dispose(), 800);
  },

  sword_clash() {
    const synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
      harmonicity: 8.5,
      modulationIndex: 40,
      resonance: 3000,
      octaves: 2,
      volume: -14,
    }).toDestination();
    synth.frequency.value = 200;
    synth.triggerAttackRelease(200, "16n");
    setTimeout(() => synth.dispose(), 600);
  },

  death_thud() {
    const synth = new Tone.MembraneSynth({
      pitchDecay: 0.15,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 },
      volume: -12,
    }).toDestination();
    synth.triggerAttackRelease("A0", "4n");
    setTimeout(() => synth.dispose(), 1500);
  },

  tantrum_scream() {
    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.3 },
      volume: -16,
    }).toDestination();
    synth.triggerAttackRelease("G#3", "8n");
    setTimeout(() => synth.dispose(), 800);
  },

  item_smash() {
    const synth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
      volume: -18,
    }).toDestination();
    synth.triggerAttackRelease("16n");
    setTimeout(() => synth.dispose(), 600);
  },

  monster_roar({ pitch = 0 } = {}) {
    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.1, decay: 0.8, sustain: 0.2, release: 0.5 },
      volume: -12,
    }).toDestination();
    synth.triggerAttackRelease(80 * Math.pow(2, pitch / 12), "4n");
    setTimeout(() => synth.dispose(), 2000);
  },

  monster_die() {
    const synth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 1.0, sustain: 0, release: 0.5 },
      volume: -16,
    }).toDestination();
    synth.triggerAttackRelease("D2", "4n");
    setTimeout(() => synth.dispose(), 2000);
  },

  stomach_growl() {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.05, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -24,
    }).toDestination();
    synth.triggerAttackRelease("G2", "4n");
    setTimeout(() => synth.dispose(), 1000);
  },

  gulp() {
    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.05 },
      volume: -28,
    }).toDestination();
    synth.triggerAttackRelease("C5", "32n");
    setTimeout(() => synth.dispose(), 300);
  },

  snore() {
    const synth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.1, decay: 0.5, sustain: 0, release: 0.3 },
      volume: -30,
    }).toDestination();
    synth.triggerAttackRelease("4n");
    setTimeout(() => synth.dispose(), 1200);
  },

  stress_sting() {
    const synth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
      volume: -20,
    }).toDestination();
    synth.triggerAttackRelease("Bb4", "8n");
    setTimeout(() => synth.dispose(), 800);
  },

  artifact_fanfare() {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
      volume: -14,
    }).toDestination();
    const now = Tone.now();
    synth.triggerAttackRelease("C4", "8n", now);
    synth.triggerAttackRelease("E4", "8n", now + 0.12);
    synth.triggerAttackRelease("G4", "8n", now + 0.24);
    synth.triggerAttackRelease(["C5", "E5"], "4n", now + 0.36);
    setTimeout(() => synth.dispose(), 3000);
  },

  fortress_fallen() {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.5, decay: 2.0, sustain: 0.5, release: 2.0 },
      volume: -10,
    }).toDestination();
    synth.triggerAttackRelease(["C3", "Eb3", "Gb3"], "2n");
    setTimeout(() => synth.dispose(), 6000);
  },

  caravan_bells() {
    const synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.5, release: 0.3 },
      harmonicity: 5.1,
      modulationIndex: 16,
      resonance: 4000,
      octaves: 0.5,
      volume: -20,
    }).toDestination();
    synth.frequency.value = 800;
    const now = Tone.now();
    [0, 0.15, 0.35].forEach((t) => synth.triggerAttackRelease(800, "8n", now + t));
    setTimeout(() => synth.dispose(), 2000);
  },

  disease_cough() {
    const synth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 },
      volume: -22,
    }).toDestination();
    const now = Tone.now();
    [0, 0.25].forEach((t) => synth.triggerAttackRelease("8n", now + t));
    setTimeout(() => synth.dispose(), 1200);
  },

  year_chime() {
    const synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.0, release: 0.5 },
      harmonicity: 2.0,
      modulationIndex: 8,
      resonance: 3000,
      octaves: 1.0,
      volume: -18,
    }).toDestination();
    synth.frequency.value = 500;
    synth.triggerAttackRelease(500, "8n", Tone.now());
    setTimeout(() => synth.dispose(), 3000);
  },

  migration_crowd() {
    const synth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.3, decay: 1.0, sustain: 0.2, release: 0.8 },
      volume: -26,
    }).toDestination();
    synth.triggerAttackRelease("2n");
    setTimeout(() => synth.dispose(), 3000);
  },
};

export function playPreset(name: SynthPresetName, options?: { pitch?: number }): void {
  PRESETS[name](options);
}
