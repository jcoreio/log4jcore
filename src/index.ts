/* eslint-disable @typescript-eslint/no-explicit-any */

export type Level = 1 | 2 | 3 | 4 | 5 | 6

export interface Logger {
  trace(...args: Array<any>): void
  debug(...args: Array<any>): void
  info(...args: Array<any>): void
  warn(...args: Array<any>): void
  error(...args: Array<any>): void
  fatal(...args: Array<any>): void
  logAtLevel(level: Level, ...args: Array<any>): void
  levelEnabled(level: Level): boolean
}

export type LogProvider = (
  loggerPath: string,
  level: Level,
  ...args: Array<any>
) => void

export type LogFunctionProvider = (level: Level) => Function

export const LOG_LEVEL_TRACE = 1
export const LOG_LEVEL_DEBUG = 2
export const LOG_LEVEL_INFO = 3
export const LOG_LEVEL_WARN = 4
export const LOG_LEVEL_ERROR = 5
export const LOG_LEVEL_FATAL = 6

const LOG_LEVEL_MIN = LOG_LEVEL_TRACE
const LOG_LEVEL_MAX = LOG_LEVEL_FATAL

const DEFAULT_LOG_LEVEL = LOG_LEVEL_INFO

const PATH_SEPARATOR = '.'

const logLevelToName = {
  [LOG_LEVEL_TRACE]: 'TRACE',
  [LOG_LEVEL_DEBUG]: 'DEBUG',
  [LOG_LEVEL_INFO]: 'INFO',
  [LOG_LEVEL_WARN]: 'WARN',
  [LOG_LEVEL_ERROR]: 'ERROR',
  [LOG_LEVEL_FATAL]: 'FATAL',
}

function assertValidLogLevel(level: Level): void {
  switch (level) {
    case LOG_LEVEL_TRACE:
    case LOG_LEVEL_DEBUG:
    case LOG_LEVEL_INFO:
    case LOG_LEVEL_WARN:
    case LOG_LEVEL_ERROR:
    case LOG_LEVEL_FATAL:
      return
    default:
      throw new Error(`invalid log level: ${level}`)
  }
}

const configuredLogLevels: { [path: string]: Level } = {}
const envLogLevels: { [path: string]: Level } = {}

const logLevelAtPath = (path: string): Level | undefined =>
  configuredLogLevels[path] || envLogLevels[path]

const envVar = (varName: string): string | undefined =>
  typeof process !== 'undefined' && process.env
    ? process.env[varName]
    : undefined // eslint-disable-line no-undef

let calcedEnvLogLevels = false
function calcEnvLogLevels(): void {
  if (calcedEnvLogLevels) return
  // walk log levels from least to most verbose, so that the most verbose setting wins if
  // the user sets DEBUG=foo and TRACE=foo, foo will be set to TRACE
  for (let logLevel = LOG_LEVEL_MAX; logLevel >= LOG_LEVEL_MIN; --logLevel) {
    const envForLevel = envVar((logLevelToName as any)[logLevel])
    if (envForLevel && typeof envForLevel === 'string') {
      const targetsForLevel = envForLevel.split(',').filter(Boolean)
      targetsForLevel.forEach((target: string) => {
        envLogLevels[target] = logLevel as Level
      })
    }
  }
  calcedEnvLogLevels = true
}

let logLevelsCache: { [path: string]: Level } = {}

export function setLogLevel(path: string, level: Level): void {
  assertValidLogLevel(level)
  if (level < LOG_LEVEL_TRACE || level > LOG_LEVEL_FATAL)
    throw Error(
      `log level must be between ${LOG_LEVEL_TRACE} and ${LOG_LEVEL_FATAL}, inclusive`
    )
  if (level !== configuredLogLevels[path]) {
    configuredLogLevels[path] = level
    // Bust the cache
    logLevelsCache = {}
  }
}

function calcLogLevel(path: string): Level {
  calcEnvLogLevels()
  const levelAtExactPath: Level | undefined = logLevelAtPath(path)
  if (levelAtExactPath != null) return levelAtExactPath
  const exactPathSplit = path.split(PATH_SEPARATOR)
  for (
    let compareLen = exactPathSplit.length - 1;
    compareLen >= 0;
    --compareLen
  ) {
    const subPath = exactPathSplit.slice(0, compareLen).join(PATH_SEPARATOR)
    const levelAtSubPath: Level | undefined = logLevelAtPath(subPath)
    if (levelAtSubPath != null) return levelAtSubPath
  }
  return DEFAULT_LOG_LEVEL
}

function logLevel(path: string): Level {
  let levelForPath: Level | undefined = logLevelsCache[path]
  if (levelForPath == null) {
    logLevelsCache[path] = levelForPath = calcLogLevel(path)
  }
  return levelForPath
}

const hasDate = !envVar('LOG_NO_DATE')

const defaultLogFunctionProvider: LogFunctionProvider = (level: Level) =>
  level >= LOG_LEVEL_ERROR ? console.error : console.log // eslint-disable-line no-console

let _logFunctionProvider: LogFunctionProvider = defaultLogFunctionProvider

/**
 * Simple hook to override the logging function. For example, to always log to console.error,
 * call setLogFunctionProvider(() => console.error)
 * @param provider function that returns the log function based on the message's log level
 */
export function setLogFunctionProvider(provider: LogFunctionProvider): void {
  _logFunctionProvider = provider
}

function formatDate(d: Date): string {
  function part(n: number, width = 2): string {
    return String(n).padStart(width, '0')
  }
  return `${part(d.getFullYear(), 4)}-${part(d.getMonth() + 1)}-${part(
    d.getDate()
  )} ${part(d.getHours())}:${part(d.getMinutes())}:${part(d.getSeconds())}`
}

const defaultLogProvider: LogProvider = (
  loggerPath: string,
  level: Level,
  ...args: Array<any>
) => {
  const logFunc: Function = _logFunctionProvider(level)
  const date = hasDate ? formatDate(new Date()) + ' ' : ''
  logFunc(`[${date}${loggerPath}] ${(logLevelToName as any)[level]}`, ...args)
}

let _logProvider: LogProvider = defaultLogProvider

/**
 * Hook to provide a complete replacement for the log provider.
 * @param provider
 */
export function setLogProvider(provider: LogProvider): void {
  _logProvider = provider
}

const loggersByPath: { [loggerPath: string]: Logger } = {}

function createLogger(loggerPath: string): Logger {
  const logAtLevel = (level: Level, ...args: Array<any>): void => {
    if (level >= logLevel(loggerPath)) {
      let argsToLogger: Array<any> = args
      if (args.length === 1 && typeof args[0] === 'function') {
        // A single function was passed. Execute that function and log the result.
        // This allows debug text to only be calculated when the relevant debug level is
        // enabled, e.g. log.trace(() => JSON.stringify(data))
        const resolvedArgs = args[0]()
        argsToLogger = Array.isArray(resolvedArgs)
          ? resolvedArgs
          : [resolvedArgs]
      }
      _logProvider(loggerPath, level, ...argsToLogger)
    }
  }
  return {
    trace: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_TRACE, ...args),
    debug: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_DEBUG, ...args),
    info: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_INFO, ...args),
    warn: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_WARN, ...args),
    error: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_ERROR, ...args),
    fatal: (...args: Array<any>): void => logAtLevel(LOG_LEVEL_FATAL, ...args),
    logAtLevel,
    levelEnabled: (level: number): boolean => level >= logLevel(loggerPath),
  }
}

export function logger(loggerPath = ''): Logger {
  let logger = loggersByPath[loggerPath]
  if (!logger) logger = loggersByPath[loggerPath] = createLogger(loggerPath)
  return logger
}

export default logger
