import { query, removeEntity } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Job, JobType, JobState } from '@core/components/job'

export { JobType, JobState }

/**
 * Claim a job for a dwarf. Returns false if the job is no longer available.
 */
export function claimJob(world: GameWorld, dwarfEid: number, jobEid: number): boolean {
  if ((Job.state[jobEid] as JobState) !== JobState.Available) return false
  Job.state[jobEid] = JobState.InProgress
  Job.claimedBy[jobEid] = dwarfEid
  return true
}

/**
 * Release a job back to available state, resetting progress.
 */
export function releaseJob(_world: GameWorld, jobEid: number): void {
  Job.state[jobEid] = JobState.Available
  Job.claimedBy[jobEid] = -1
  Job.progress[jobEid] = 0
}

/**
 * Mark a job as complete.
 */
export function completeJob(_world: GameWorld, jobEid: number): void {
  Job.state[jobEid] = JobState.Complete
}

/**
 * Get all available jobs of the specified types, sorted by priority descending.
 */
export function getAvailableJobs(world: GameWorld, jobTypes: JobType[]): number[] {
  const all = query(world, [Job])
  const result: number[] = []
  for (let i = 0; i < all.length; i++) {
    const eid = all[i]!
    if (
      (Job.state[eid] as JobState) === JobState.Available &&
      jobTypes.includes(Job.jobType[eid] as JobType)
    ) {
      result.push(eid)
    }
  }
  result.sort((a, b) => (Job.priority[b] ?? 0) - (Job.priority[a] ?? 0))
  return result
}

/**
 * System that removes completed/cancelled job entities from the world.
 */
export function jobCleanupSystem(world: GameWorld): void {
  const all = query(world, [Job])
  for (let i = 0; i < all.length; i++) {
    const eid = all[i]!
    const state = Job.state[eid] as JobState
    if (state === JobState.Complete || state === JobState.Cancelled) {
      removeEntity(world, eid)
    }
  }
}
