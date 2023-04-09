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
  inputLogProvider: LogProvider
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

const TRACE = 'TRACE'
const DEBUG = 'DEBUG'
const INFO = 'INFO'
const WARN = 'WARN'
const ERROR = 'ERROR'
const FATAL = 'FATAL'

const LOG_NO_DATE = 'LOG_NO_DATE'

const ALL_ENV_VARS = new Set([
  TRACE,
  DEBUG,
  INFO,
  WARN,
  ERROR,
  FATAL,
  LOG_NO_DATE,
])

export const logLevelToName: {
  1: 'TRACE'
  2: 'DEBUG'
  3: 'INFO'
  4: 'WARN'
  5: 'ERROR'
  6: 'FATAL'
} = {
  [LOG_LEVEL_TRACE]: TRACE,
  [LOG_LEVEL_DEBUG]: DEBUG,
  [LOG_LEVEL_INFO]: INFO,
  [LOG_LEVEL_WARN]: WARN,
  [LOG_LEVEL_ERROR]: ERROR,
  [LOG_LEVEL_FATAL]: FATAL,
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

/** log levels explicitly configured by the user. Highest priority. */
let configuredLogLevels: { [path: string]: Level } = {}
/** log levels configured by environment variables. Lowest priority. */
let envLogLevels: { [path: string]: Level } = {}
/** calculated levels based on configuredLogLevels and envLogLevels  */
let logLevelsCache: { [path: string]: Level } = {}

const logLevelAtPath = (path: string): Level | undefined =>
  configuredLogLevels[path] || envLogLevels[path]

const envVar = (varName: string): string | undefined =>
  typeof process !== 'undefined' && process.env
    ? process.env[varName]
    : undefined // eslint-disable-line no-undef

const calcHasDate = (): boolean => !parseInt(envVar(LOG_NO_DATE) || '')
let hasDate = calcHasDate()

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

export function envVarChanged(
  varName: string | undefined = undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  newValue: string | null | undefined = undefined
): void {
  if (!varName || ALL_ENV_VARS.has(varName)) {
    console.log('re-calculating log levels')
    calcedEnvLogLevels = false
    envLogLevels = {}
    logLevelsCache = {}
    hasDate = calcHasDate()
  }
}

export function resetLogLevels(): void {
  logLevelsCache = {}
  configuredLogLevels = {}
}

export function setLogLevel(path: string, level: Level): void {
  assertValidLogLevel(level)
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

export const defaultLogFunctionProvider: LogFunctionProvider = (level: Level) =>
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

function defaultLogFormat(loggerPath: string, level: Level): string {
  const date = hasDate ? formatDate(new Date()) + ' ' : ''
  return `[${date}${loggerPath}] ${(logLevelToName as any)[level]}`
}

export function createDefaultLogProvider(logFunc: Function): LogProvider {
  return (loggerPath: string, level: Level, ...args: Array<any>): void => {
    logFunc(defaultLogFormat(loggerPath, level), ...args)
  }
}

export const defaultLogProvider: LogProvider = (
  loggerPath: string,
  level: Level,
  ...args: Array<any>
) => {
  const logFunc: Function = _logFunctionProvider(level)
  logFunc(defaultLogFormat(loggerPath, level), ...args)
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

class LoggerImpl implements Logger {
  loggerPath: string
  _logProviders: LogProvider[] | undefined

  constructor({ loggerPath, logProviders }: CreateLoggerOptions) {
    this.loggerPath = loggerPath
    this._logProviders = logProviders
  }

  logAtLevel = (level: Level, ...args: Array<any>): void => {
    if (level >= logLevel(this.loggerPath)) {
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
      for (const provider of this._logProviders || [_logProvider]) {
        provider(this.loggerPath, level, ...argsToLogger)
      }
    }
  }
  levelEnabled = (level: number): boolean => {
    return level >= logLevel(this.loggerPath)
  }
  inputLogProvider: LogProvider = (
    loggerPath: string,
    level: Level,
    ...args: Array<any>
  ): void => {
    this.logAtLevel(level, ...args)
  }
  trace = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_TRACE, ...args)
  }
  debug = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_DEBUG, ...args)
  }
  info = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_INFO, ...args)
  }
  warn = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_WARN, ...args)
  }
  error = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_ERROR, ...args)
  }
  fatal = (...args: Array<any>): void => {
    this.logAtLevel(LOG_LEVEL_FATAL, ...args)
  }
}

export type CreateLoggerOptions = {
  loggerPath: string
  logProviders?: LogProvider[]
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return new LoggerImpl(options)
}

export function logger(loggerPath = ''): Logger {
  let logger = loggersByPath[loggerPath]
  if (!logger) logger = loggersByPath[loggerPath] = createLogger({ loggerPath })
  return logger
}

export default logger
