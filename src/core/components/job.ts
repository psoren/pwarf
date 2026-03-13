import { MAX_ENTITIES } from '@core/constants'

export const enum JobType {
  Mine  = 0,
  Haul  = 1,
  Build = 2,
  Eat   = 3,
  Drink = 4,
  Sleep = 5,
  Idle  = 6,
  Chop  = 7,
  Farm  = 8,
  Cook  = 9,
  Smith = 10,
}

export const enum JobState {
  Available  = 0,
  Claimed    = 1,
  InProgress = 2,
  Complete   = 3,
  Cancelled  = 4,
}

export const Job = {
  jobType:     new Uint8Array(MAX_ENTITIES),
  state:       new Uint8Array(MAX_ENTITIES),
  claimedBy:   new Int32Array(MAX_ENTITIES),  // -1 if unclaimed
  targetX:     new Int32Array(MAX_ENTITIES),
  targetY:     new Int32Array(MAX_ENTITIES),
  targetZ:     new Int16Array(MAX_ENTITIES),  // storageZ
  priority:    new Int32Array(MAX_ENTITIES),
  progress:    new Float32Array(MAX_ENTITIES),
  // For haul jobs: the item being hauled and destination
  haulItemEid: new Int32Array(MAX_ENTITIES),  // -1 if not haul
  haulDestX:   new Int32Array(MAX_ENTITIES),
  haulDestY:   new Int32Array(MAX_ENTITIES),
  haulDestZ:   new Int16Array(MAX_ENTITIES),
  haulZoneEid: new Int32Array(MAX_ENTITIES),  // -1 if none
}
