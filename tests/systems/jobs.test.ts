import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { Job, JobType, JobState } from '@core/components/job'
import { claimJob, releaseJob, completeJob, getAvailableJobs, jobCleanupSystem } from '@systems/jobSystem'

function makeJob(world: GameWorld, type: JobType, priority = 5): number {
  const eid = addEntity(world)
  addComponent(world, eid, Job)
  Job.jobType[eid] = type
  Job.state[eid] = JobState.Available
  Job.claimedBy[eid] = -1
  Job.priority[eid] = priority
  Job.progress[eid] = 0
  Job.haulItemEid[eid] = -1
  return eid
}

describe('jobSystem', () => {
  let world: GameWorld

  beforeEach(() => {
    world = createGameWorld()
  })

  describe('claimJob', () => {
    it('claims an available job for a dwarf', () => {
      const jobEid = makeJob(world, JobType.Mine)
      const result = claimJob(world, 42, jobEid)
      expect(result).toBe(true)
      expect(Job.state[jobEid]).toBe(JobState.InProgress)
      expect(Job.claimedBy[jobEid]).toBe(42)
    })

    it('returns false if job is not available', () => {
      const jobEid = makeJob(world, JobType.Mine)
      claimJob(world, 42, jobEid)
      const result = claimJob(world, 43, jobEid)
      expect(result).toBe(false)
      expect(Job.claimedBy[jobEid]).toBe(42)
    })
  })

  describe('releaseJob', () => {
    it('returns job to Available and resets progress', () => {
      const jobEid = makeJob(world, JobType.Mine)
      claimJob(world, 42, jobEid)
      Job.progress[jobEid] = 0.5
      releaseJob(world, jobEid)
      expect(Job.state[jobEid]).toBe(JobState.Available)
      expect(Job.claimedBy[jobEid]).toBe(-1)
      expect(Job.progress[jobEid]).toBe(0)
    })
  })

  describe('completeJob', () => {
    it('marks job as Complete', () => {
      const jobEid = makeJob(world, JobType.Mine)
      completeJob(world, jobEid)
      expect(Job.state[jobEid]).toBe(JobState.Complete)
    })
  })

  describe('getAvailableJobs', () => {
    it('returns only available jobs of the requested types', () => {
      const mineJob = makeJob(world, JobType.Mine)
      const haulJob = makeJob(world, JobType.Haul)
      makeJob(world, JobType.Build)  // should not appear

      const mineJobs = getAvailableJobs(world, [JobType.Mine])
      expect(mineJobs).toContain(mineJob)
      expect(mineJobs).not.toContain(haulJob)

      const both = getAvailableJobs(world, [JobType.Mine, JobType.Haul])
      expect(both).toContain(mineJob)
      expect(both).toContain(haulJob)
    })

    it('sorts by priority descending', () => {
      const low  = makeJob(world, JobType.Mine, 1)
      const high = makeJob(world, JobType.Mine, 10)
      const mid  = makeJob(world, JobType.Mine, 5)
      const result = getAvailableJobs(world, [JobType.Mine])
      expect(result[0]).toBe(high)
      expect(result[1]).toBe(mid)
      expect(result[2]).toBe(low)
    })

    it('excludes claimed/complete jobs', () => {
      const jobEid = makeJob(world, JobType.Mine)
      claimJob(world, 1, jobEid)
      expect(getAvailableJobs(world, [JobType.Mine])).toHaveLength(0)
    })
  })

  describe('jobCleanupSystem', () => {
    it('removes completed job entities', () => {
      const jobEid = makeJob(world, JobType.Mine)
      completeJob(world, jobEid)
      jobCleanupSystem(world)
      expect(getAvailableJobs(world, [JobType.Mine])).toHaveLength(0)
    })

    it('removes cancelled job entities', () => {
      const jobEid = makeJob(world, JobType.Mine)
      Job.state[jobEid] = JobState.Cancelled
      jobCleanupSystem(world)
      expect(getAvailableJobs(world, [JobType.Mine])).toHaveLength(0)
    })

    it('preserves available and in-progress jobs', () => {
      const available = makeJob(world, JobType.Mine)
      const inProgress = makeJob(world, JobType.Mine)
      claimJob(world, 1, inProgress)
      jobCleanupSystem(world)
      const jobs = getAvailableJobs(world, [JobType.Mine])
      expect(jobs).toContain(available)
    })
  })
})
