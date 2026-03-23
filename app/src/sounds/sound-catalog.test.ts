import { describe, it, expect } from "vitest";
import { CATEGORY_SOUNDS, monsterRoarPitch } from "./sound-catalog.js";

describe("CATEGORY_SOUNDS", () => {
  it("maps battle to sword_clash", () => {
    expect(CATEGORY_SOUNDS["battle"]).toBe("sword_clash");
  });

  it("maps death to death_thud", () => {
    expect(CATEGORY_SOUNDS["death"]).toBe("death_thud");
  });

  it("maps artifact_created to artifact_fanfare", () => {
    expect(CATEGORY_SOUNDS["artifact_created"]).toBe("artifact_fanfare");
  });

  it("maps fortress_fallen to fortress_fallen", () => {
    expect(CATEGORY_SOUNDS["fortress_fallen"]).toBe("fortress_fallen");
  });

  it("maps trade_caravan_arrival to caravan_bells", () => {
    expect(CATEGORY_SOUNDS["trade_caravan_arrival"]).toBe("caravan_bells");
  });

  it("maps monster_sighting to monster_roar", () => {
    expect(CATEGORY_SOUNDS["monster_sighting"]).toBe("monster_roar");
  });

  it("maps monster_slain to monster_die", () => {
    expect(CATEGORY_SOUNDS["monster_slain"]).toBe("monster_die");
  });

  it("maps migration to migration_crowd", () => {
    expect(CATEGORY_SOUNDS["migration"]).toBe("migration_crowd");
  });

  it("has no mapping for categories that shouldn't play sounds", () => {
    expect(CATEGORY_SOUNDS["birth"]).toBeUndefined();
    expect(CATEGORY_SOUNDS["fortress_founded"]).toBeUndefined();
    expect(CATEGORY_SOUNDS["discovery"]).toBeUndefined();
  });
});

describe("monsterRoarPitch", () => {
  it("returns negative pitch for high-threat monsters (dragon tier)", () => {
    expect(monsterRoarPitch(8)).toBeLessThan(0);
    expect(monsterRoarPitch(10)).toBeLessThan(0);
  });

  it("returns zero pitch for mid-tier threats", () => {
    expect(monsterRoarPitch(5)).toBe(0);
    expect(monsterRoarPitch(7)).toBe(0);
  });

  it("returns positive pitch for low-tier threats", () => {
    expect(monsterRoarPitch(1)).toBeGreaterThan(0);
    expect(monsterRoarPitch(4)).toBeGreaterThan(0);
  });
});
