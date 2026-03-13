import { MAX_ENTITIES } from '@core/constants'

export const enum DesignationType {
  Mine = 0,
}

export const Designation = {
  desType: new Uint8Array(MAX_ENTITIES),
  tileX:   new Int32Array(MAX_ENTITIES),
  tileY:   new Int32Array(MAX_ENTITIES),
  tileZ:   new Int16Array(MAX_ENTITIES),  // storageZ
  jobEid:  new Int32Array(MAX_ENTITIES),  // job entity for this designation
}
