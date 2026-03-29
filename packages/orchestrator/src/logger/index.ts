import type { LogLevel } from './types'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

class Logger {
  private minLevel: LogLevel = 'info'

  setLevel(level: LogLevel) {
    this.minLevel = level
  }

  private log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return

    // Console transport (always active)
    const prefix = `[${module}]`
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''
    switch (level) {
      case 'debug':
        console.debug(prefix, message, dataStr)
        break
      case 'info':
        console.log(prefix, message, dataStr)
        break
      case 'warn':
        console.warn(prefix, message, dataStr)
        break
      case 'error':
        console.error(prefix, message, dataStr)
        break
    }
  }

  debug(module: string, message: string, data?: Record<string, unknown>) {
    this.log('debug', module, message, data)
  }
  info(module: string, message: string, data?: Record<string, unknown>) {
    this.log('info', module, message, data)
  }
  warn(module: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', module, message, data)
  }
  error(module: string, message: string, data?: Record<string, unknown>) {
    this.log('error', module, message, data)
  }
}

export const logger = new Logger()
export type { LogLevel, LogEntry } from './types'
