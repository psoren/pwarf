export type Level = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  _time: string
  level: Level
  event: string
  data?: Record<string, unknown>
}

type Sink = (entries: LogEntry[]) => void | Promise<void>

let _buffer: LogEntry[] = []
let _sink: Sink | null = null
let _flushTimer: ReturnType<typeof setInterval> | null = null

/**
 * Initialize Axiom logging. Call once at app startup.
 * No-op if token/dataset are absent — safe to call unconditionally.
 */
export function initLogger(config: {
  token: string
  dataset: string
  flushIntervalMs?: number
}): void {
  const { token, dataset, flushIntervalMs = 10_000 } = config

  _sink = async (entries: LogEntry[]) => {
    try {
      await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entries),
      })
    } catch {
      // silent failure — logging must never crash the game
    }
  }

  _flushTimer = setInterval(() => { void _flush() }, flushIntervalMs)

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { void _flush() })
  }
}

/** Replace the flush sink. Pass `null` to disable (useful in tests). */
export function setSink(sink: Sink | null): void {
  _sink = sink
}

/** Return a snapshot of the current in-memory buffer. */
export function getBuffer(): readonly LogEntry[] {
  return _buffer
}

/** Discard all buffered entries without flushing. */
export function clearBuffer(): void {
  _buffer = []
}

/** Stop the flush interval and clear the sink. Call in test teardown. */
export function stopLogger(): void {
  if (_flushTimer !== null) {
    clearInterval(_flushTimer)
    _flushTimer = null
  }
  _sink = null
}

/** Record a structured log entry. */
export function log(level: Level, event: string, data?: Record<string, unknown>): void {
  _buffer.push({
    _time: new Date().toISOString(),
    level,
    event,
    ...(data !== undefined ? { data } : {}),
  })
}

/** Flush buffered entries to the sink immediately. */
export async function flushNow(): Promise<void> {
  await _flush()
}

async function _flush(): Promise<void> {
  if (_buffer.length === 0 || _sink === null) return
  const entries = _buffer.splice(0)
  try {
    await _sink(entries)
  } catch {
    // silent failure
  }
}
