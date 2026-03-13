import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  log,
  getBuffer,
  clearBuffer,
  setSink,
  flushNow,
  stopLogger,
} from '@core/logger'
import type { LogEntry } from '@core/logger'

describe('logger', () => {
  beforeEach(() => {
    clearBuffer()
    setSink(null)
  })

  afterEach(() => {
    stopLogger()
    clearBuffer()
  })

  it('buffers an entry with correct shape', () => {
    log('info', 'test.event', { key: 'value' })
    const buffer = getBuffer()
    expect(buffer).toHaveLength(1)
    const entry = buffer[0]!
    expect(entry.level).toBe('info')
    expect(entry.event).toBe('test.event')
    expect(entry.data).toEqual({ key: 'value' })
    expect(entry._time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('omits data field when not provided', () => {
    log('warn', 'test.no_data')
    const entry = getBuffer()[0]!
    expect('data' in entry).toBe(false)
  })

  it('buffers multiple entries in order', () => {
    log('debug', 'first')
    log('error', 'second')
    const buffer = getBuffer()
    expect(buffer).toHaveLength(2)
    expect(buffer[0]!.event).toBe('first')
    expect(buffer[1]!.event).toBe('second')
  })

  it('flushNow sends buffered entries to the sink and clears the buffer', async () => {
    const received: LogEntry[] = []
    setSink((entries) => { received.push(...entries) })
    log('info', 'a')
    log('info', 'b')
    await flushNow()
    expect(received).toHaveLength(2)
    expect(getBuffer()).toHaveLength(0)
  })

  it('flushNow is a no-op when sink is null', async () => {
    log('info', 'no.sink')
    await flushNow()
    expect(getBuffer()).toHaveLength(1)
  })

  it('flushNow is a no-op when buffer is empty', async () => {
    let called = false
    setSink(() => { called = true })
    await flushNow()
    expect(called).toBe(false)
  })

  it('clearBuffer discards entries without flushing', () => {
    log('info', 'to.discard')
    clearBuffer()
    expect(getBuffer()).toHaveLength(0)
  })
})
