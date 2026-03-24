import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tone.js before importing soundtrack
vi.mock("tone", () => {
  function MockGain() {
    return {
      gain: { rampTo: vi.fn() },
      toDestination: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    };
  }
  function MockPolySynth() {
    return {
      triggerAttack: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    };
  }
  function MockSynth() {
    return {
      triggerAttackRelease: vi.fn(),
      dispose: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    };
  }
  function MockLoop() {
    return {
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
  }
  const mockTransport = {
    state: "stopped",
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  };
  return {
    Gain: vi.fn(MockGain),
    PolySynth: vi.fn(MockPolySynth),
    Synth: vi.fn(MockSynth),
    Loop: vi.fn(MockLoop),
    getTransport: vi.fn(() => mockTransport),
    dbToGain: vi.fn((db: number) => Math.pow(10, db / 20)),
    start: vi.fn(() => Promise.resolve()),
  };
});

describe("soundtrack", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("startSoundtrack initializes and starts transport", async () => {
    const Tone = await import("tone");
    const { startSoundtrack } = await import("./soundtrack.js");

    startSoundtrack();

    expect(Tone.PolySynth).toHaveBeenCalled();
    expect(Tone.Synth).toHaveBeenCalled();
    expect(Tone.Loop).toHaveBeenCalled();
    expect(Tone.getTransport().start).toHaveBeenCalled();
  });

  it("stopSoundtrack stops transport", async () => {
    const Tone = await import("tone");
    const { startSoundtrack, stopSoundtrack } = await import("./soundtrack.js");

    startSoundtrack();
    stopSoundtrack();

    expect(Tone.getTransport().stop).toHaveBeenCalled();
  });

  it("pauseSoundtrack pauses transport", async () => {
    const Tone = await import("tone");
    const { startSoundtrack, pauseSoundtrack } = await import("./soundtrack.js");

    startSoundtrack();
    pauseSoundtrack();

    expect(Tone.getTransport().pause).toHaveBeenCalled();
  });

  it("setSoundtrackMuted ramps gain to 0 when muted", async () => {
    const Tone = await import("tone");
    const { startSoundtrack, setSoundtrackMuted } = await import("./soundtrack.js");

    startSoundtrack();
    setSoundtrackMuted(true);

    const gainInstance = (Tone.Gain as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(gainInstance.gain.rampTo).toHaveBeenCalledWith(0, 0.3);
  });

  it("disposeSoundtrack cleans up all resources", async () => {
    const Tone = await import("tone");
    const { startSoundtrack, disposeSoundtrack } = await import("./soundtrack.js");

    startSoundtrack();
    disposeSoundtrack();

    const synthInstance = (Tone.Synth as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(synthInstance.dispose).toHaveBeenCalled();
  });

  it("calling startSoundtrack twice does not re-initialize", async () => {
    const Tone = await import("tone");
    const { startSoundtrack } = await import("./soundtrack.js");

    startSoundtrack();
    // Simulate transport already running
    (Tone.getTransport() as unknown as Record<string, string>).state = "started";
    startSoundtrack();

    // PolySynth should only be constructed once
    expect(Tone.PolySynth).toHaveBeenCalledTimes(1);
  });
});
