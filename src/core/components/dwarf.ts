import { MAX_ENTITIES } from '@core/constants'

export const enum DwarfState {
  Idle         = 0,
  SeekingJob   = 1,
  ExecutingJob = 2,
  Eating       = 3,
  Drinking     = 4,
  Sleeping     = 5,
  Tantrum      = 6,
  Dead         = 7,
}

export const enum LaborType {
  Mining      = 1 << 0,
  Hauling     = 1 << 1,
  Woodcutting = 1 << 2,
  Farming     = 1 << 3,
  Cooking     = 1 << 4,
  Smithing    = 1 << 5,
  Carpentry   = 1 << 6,
}

export const Skills = {
  mining:      new Int8Array(MAX_ENTITIES),
  woodcutting: new Int8Array(MAX_ENTITIES),
  masonry:     new Int8Array(MAX_ENTITIES),
  carpentry:   new Int8Array(MAX_ENTITIES),
  smithing:    new Int8Array(MAX_ENTITIES),
  cooking:     new Int8Array(MAX_ENTITIES),
  brewing:     new Int8Array(MAX_ENTITIES),
  farming:     new Int8Array(MAX_ENTITIES),
  combat:      new Int8Array(MAX_ENTITIES),
  medical:     new Int8Array(MAX_ENTITIES),
}

export const Needs = {
  hunger: new Float32Array(MAX_ENTITIES),  // 1.0 = full, 0.0 = starving
  thirst: new Float32Array(MAX_ENTITIES),
  sleep:  new Float32Array(MAX_ENTITIES),
}

export const DwarfAI = {
  state:          new Uint8Array(MAX_ENTITIES),   // DwarfState
  jobEid:         new Int32Array(MAX_ENTITIES),   // -1 if no job
  sleepTimer:     new Int32Array(MAX_ENTITIES),
  tantrumTimer:   new Int32Array(MAX_ENTITIES),
  eatTargetEid:   new Int32Array(MAX_ENTITIES),   // item eid being sought for eating (-1 if none)
  drinkTargetEid: new Int32Array(MAX_ENTITIES),   // item eid being sought for drinking
}

export const Labor = {
  enabled: new Uint32Array(MAX_ENTITIES),  // LaborType bitmask, default all enabled
}

export const ALL_LABORS =
  LaborType.Mining | LaborType.Hauling | LaborType.Woodcutting |
  LaborType.Farming | LaborType.Cooking | LaborType.Smithing | LaborType.Carpentry
