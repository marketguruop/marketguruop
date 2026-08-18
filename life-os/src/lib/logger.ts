type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, scope: string, message: string, meta?: unknown): void {
  const line = { level, scope, message, ts: new Date().toISOString(), ...(meta ? { meta } : {}) }
  const serialized = JSON.stringify(line)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.log(serialized)
}

export function logger(scope: string) {
  return {
    debug: (m: string, meta?: unknown) => emit('debug', scope, m, meta),
    info: (m: string, meta?: unknown) => emit('info', scope, m, meta),
    warn: (m: string, meta?: unknown) => emit('warn', scope, m, meta),
    error: (m: string, meta?: unknown) => emit('error', scope, m, meta),
  }
}
