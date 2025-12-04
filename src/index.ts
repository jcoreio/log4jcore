import * as core from './core'

const logger: typeof core.logger &
  typeof core & { logger: typeof core.logger } = Object.assign(
  core.logger,
  core,
  { logger: core.logger }
)
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace logger {
  export type Level = core.Level
  export type Logger = core.Logger
  export type LogProvider = core.LogProvider
  export type CreateLoggerOptions = core.CreateLoggerOptions
  // export type LogFunctionProvider = core.LogFunctionProvider
}

export = logger
