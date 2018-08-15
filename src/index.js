/**
 * @flow
 *
 * Simple replacement for log4js that can run in the browser
 */

import {compact, isFunction, isInteger, isString, once} from 'lodash'
import moment from 'moment'

export type Logger = {
  trace: (...args: Array<any>) => void,
  debug: (...args: Array<any>) => void,
  info: (...args: Array<any>) => void,
  warn: (...args: Array<any>) => void,
  error: (...args: Array<any>) => void,
  fatal: (...args: Array<any>) => void,
  logAtLevel: (level: number, ...args: Array<any>) => void,
  levelEnabled: (level: number) => boolean,
}

export type LogProvider = (loggerPath: string, level: number, ...args: Array<any>) => void

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

//const nameToLogLevel = invert(logLevelToName)

const configuredLogLevels: {[path: string]: number} = {}
const envLogLevels: {[path: string]: number} = {}

const logLevelAtPath = (path: string) => configuredLogLevels[path] || envLogLevels[path]

const envVar = (varName: string) => (process && process.env) ? process.env[varName] : undefined // eslint-disable-line no-undef

const calcEnvLogLevels = once(() => {
  // walk log levels from least to most verbose, so that the most verbose setting wins if
  // the user sets DEBUG=foo and TRACE=foo, foo will be set to TRACE
  for (let logLevel = LOG_LEVEL_MAX; logLevel >= LOG_LEVEL_MIN; --logLevel) {
    const envForLevel = envVar(logLevelToName[logLevel])
    if (envForLevel && isString(envForLevel)) {
      const targetsForLevel = compact(envForLevel.split(','))
      targetsForLevel.forEach((target: string) => {
        envLogLevels[target] = logLevel
      })
    }
  }
})

let logLevelsCache: {[path: string]: number} = {}

export function setLogLevel(path: string, level: number) {
  if (!isInteger(level)) throw Error('log level must be an integer')
  if (level < LOG_LEVEL_TRACE || level > LOG_LEVEL_FATAL) throw Error(`log level must be between ${LOG_LEVEL_TRACE} and ${LOG_LEVEL_FATAL}, inclusive`)
  if (level !== configuredLogLevels[path]) {
    configuredLogLevels[path] = level
    // Bust the cache
    logLevelsCache = {}
  }
}

function calcLogLevel(path: string): number {
  calcEnvLogLevels()
  const levelAtExactPath: ?number = logLevelAtPath(path)
  if (levelAtExactPath != null) return levelAtExactPath
  const exactPathSplit = path.split(PATH_SEPARATOR)
  for (let compareLen = exactPathSplit.length - 1; compareLen >= 0; --compareLen) {
    const subPath = exactPathSplit.slice(0, compareLen).join(PATH_SEPARATOR)
    const levelAtSubPath: ?number = logLevelAtPath(subPath)
    if (levelAtSubPath != null) return levelAtSubPath
  }
  return DEFAULT_LOG_LEVEL
}

function logLevel(path: string): number {
  let levelForPath: ?number = logLevelsCache[path]
  if (levelForPath == null) {
    logLevelsCache[path] = levelForPath = calcLogLevel(path)
  }
  return levelForPath
}

const hasDate = !envVar('LOG_NO_DATE')

const defaultLogProvider: LogProvider = (loggerPath: string, level: number, ...args: Array<any>) => {
  if (level >= logLevel(loggerPath)) {
    const isDeferredLog = args.length === 1 && isFunction(args[0])
    const argsToLogger: Array<any> = isDeferredLog ? [args[0]()] : args

    /* eslint-disable no-console */
    const consoleLogFunc = (level >= LOG_LEVEL_ERROR) ? console.error : console.log
    const date = hasDate ? moment().format('YYYY-MM-DD HH:mm:ss') + ' ' : ''
    consoleLogFunc(`[${date}${loggerPath}] ${logLevelToName[level]}`, ...argsToLogger)
  }
}

let _logProvider: LogProvider = defaultLogProvider

export function setLogProvider(provider: LogProvider) {
  _logProvider = provider
}

const loggersByPath: {[loggerPath: string]: Logger} = {}

export default function logger(loggerPath: string = ''): Logger {
  let logger = loggersByPath[loggerPath]
  if (!logger)
    logger = loggersByPath[loggerPath] = createLogger(loggerPath)
  return logger
}

function createLogger(loggerPath: string): Logger {
  const logAtLevel = (level: number, ...args: Array<any>) => _logProvider(loggerPath, level, ...args)
  return {
    trace: (...args: Array<any>) => logAtLevel(LOG_LEVEL_TRACE, ...args),
    debug: (...args: Array<any>) => logAtLevel(LOG_LEVEL_DEBUG, ...args),
    info: (...args: Array<any>) => logAtLevel(LOG_LEVEL_INFO, ...args),
    warn: (...args: Array<any>) => logAtLevel(LOG_LEVEL_WARN, ...args),
    error: (...args: Array<any>) => logAtLevel(LOG_LEVEL_ERROR, ...args),
    fatal: (...args: Array<any>) => logAtLevel(LOG_LEVEL_FATAL, ...args),
    logAtLevel,
    levelEnabled: (level: number) => level >= logLevel(loggerPath),
  }
}
