/**
 * @flow
 *
 * Simple replacement for log4js that can run in the browser
 */

import _ from 'lodash'

export type Logger = {
  trace: (...args: Array<any>) => void,
  debug: (...args: Array<any>) => void,
  info: (...args: Array<any>) => void,
  warn: (...args: Array<any>) => void,
  error: (...args: Array<any>) => void,
  fatal: (...args: Array<any>) => void,
}

export type LogProvider = (loggerPath: string, level: number, ...args: Array<any>) => void

export const LOG_LEVEL_TRACE = 1
export const LOG_LEVEL_DEBUG = 2
export const LOG_LEVEL_INFO = 3
export const LOG_LEVEL_WARN = 4
export const LOG_LEVEL_ERROR = 5
export const LOG_LEVEL_FATAL = 6

const DEFAULT_LOG_LEVEL = LOG_LEVEL_INFO

const PATH_SEPARATOR = '/'

const logLevelToName = {
  [LOG_LEVEL_TRACE]: 'TRACE',
  [LOG_LEVEL_DEBUG]: 'DEBUG',
  [LOG_LEVEL_INFO]: 'INFO',
  [LOG_LEVEL_WARN]: 'WARN',
  [LOG_LEVEL_ERROR]: 'ERROR',
  [LOG_LEVEL_FATAL]: 'FATAL',
}

//const nameToLogLevel = _.invert(logLevelToName)

const configuredLogLevels: {[path: string]: number} = {}

let logLevelsCache: {[path: string]: number} = {}

export function setLogLevel(path: string, level: number) {
  if (!_.isInteger(level)) throw Error('log level must be an integer')
  if (level < LOG_LEVEL_TRACE || level > LOG_LEVEL_FATAL) throw Error(`log level must be between ${LOG_LEVEL_TRACE} and ${LOG_LEVEL_FATAL}, inclusive`)
  if (level !== configuredLogLevels[path]) {
    configuredLogLevels[path] = level
    // Bust the cache
    logLevelsCache = {}
  }
}

function calcLogLevel(path: string): number {
  const levelAtExactPath: ?number = configuredLogLevels[path]
  if (levelAtExactPath != null) return levelAtExactPath
  const exactPathSplit = path.split(PATH_SEPARATOR)
  for (let compareLen = exactPathSplit.length - 1; compareLen >= 0; --compareLen) {
    const subPath = exactPathSplit.slice(0, compareLen).join(PATH_SEPARATOR)
    const levelAtSubPath: ?number = configuredLogLevels[subPath]
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

const defaultLogProvider: LogProvider = (loggerPath: string, level: number, ...args: Array<any>) => {
  if (level >= logLevel(loggerPath)) {
    const isDeferredLog = args.length === 1 && _.isFunction(args[0])
    const argsToLogger: Array<any> = isDeferredLog ? [args[0]()] : args

    /* eslint-disable no-console */
    const consoleLogFunc = (level >= LOG_LEVEL_ERROR) ? console.error : console.log
    consoleLogFunc(`[${loggerPath}] ${logLevelToName[level]}`, ...argsToLogger)
  }
}

let _logProvider: LogProvider = defaultLogProvider

export function setLogProvider(provider: LogProvider) {
  _logProvider = provider
}

const loggersByPath: {[loggerPath: string]: Logger} = {}

export function logger(loggerPath: string = ''): Logger {
  let logger = loggersByPath[loggerPath]
  if (!logger)
    logger = loggersByPath[loggerPath] = createLogger(loggerPath)
  return logger
}

function createLogger(loggerPath: string): Logger {
  const log = (level: number, ...args: Array<any>) => _logProvider(loggerPath, level, ...args)
  return {
    trace: (...args: Array<any>) => log(LOG_LEVEL_TRACE, ...args),
    debug: (...args: Array<any>) => log(LOG_LEVEL_DEBUG, ...args),
    info: (...args: Array<any>) => log(LOG_LEVEL_INFO, ...args),
    warn: (...args: Array<any>) => log(LOG_LEVEL_WARN, ...args),
    error: (...args: Array<any>) => log(LOG_LEVEL_ERROR, ...args),
    fatal: (...args: Array<any>) => log(LOG_LEVEL_FATAL, ...args),
  }
}
