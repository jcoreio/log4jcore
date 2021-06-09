import {
  logger,
  Level,
  LOG_LEVEL_TRACE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_FATAL,
} from '../src'

function getLevel(path: string): Level | null {
  const log = logger(path)
  for (const level of [
    LOG_LEVEL_TRACE,
    LOG_LEVEL_DEBUG,
    LOG_LEVEL_INFO,
    LOG_LEVEL_WARN,
    LOG_LEVEL_ERROR,
    LOG_LEVEL_FATAL,
  ] as Level[]) {
    if (log.levelEnabled(level)) return level
  }
  return null
}

if (process.send) {
  process.send({
    foo: getLevel('foo'),
    'foo.bar': getLevel('foo.bar'),
    'foo.baz': getLevel('foo.baz'),
    baz: getLevel('baz'),
    qux: getLevel('qux'),
  })
}
