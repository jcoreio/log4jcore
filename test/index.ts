import { describe, it } from 'mocha'
import { expect } from 'chai'
import { spawn } from 'child_process'
import lodashFp from 'lodash/fp'
const { pick } = lodashFp
import emitted from 'p-event'
import {
  setLogProvider,
  defaultLogProvider,
  setLogFunctionProvider,
  defaultLogFunctionProvider,
  logger,
  resetLogLevels,
  setLogLevel,
  LOG_LEVEL_TRACE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_FATAL,
  Level,
  createLogger,
  createDefaultLogProvider,
} from '../src/index'
import sinon from 'sinon'
import memoryLogProvider from '../src/memoryLogProvider'
import writableLogFunction from '../src/writableLogFunction'
import MemoryWritableStream from './MemoryWritableStream'
import { envVarChanged } from '../src/core.ts'

const levels: Level[] = [
  LOG_LEVEL_TRACE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_FATAL,
]

beforeEach(() => {
  delete process.env.FATAL
  delete process.env.ERROR
  delete process.env.WARN
  delete process.env.INFO
  delete process.env.DEBUG
  delete process.env.TRACE
  resetLogLevels()
})

describe(`defaultLogProvider`, function () {
  const logFunctionProvider = sinon.spy()

  beforeEach(() => {
    setLogProvider(defaultLogProvider)
    setLogFunctionProvider(() => logFunctionProvider)
    logFunctionProvider.resetHistory()
  })

  afterEach(() => {
    setLogFunctionProvider(defaultLogFunctionProvider)
  })

  it(`formats date correctly`, function () {
    const log = logger('test')
    log.info('message', 1)
    expect(logFunctionProvider.args[0][0]).to.match(
      /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3} test\] INFO$/
    )
  })
  it(`passes remaining args`, async function () {
    const log = logger('test')
    log.info('message', 1)
    expect(logFunctionProvider.args[0].slice(1)).to.deep.equal(['message', 1])
  })
  it(`passes remaining args when logging with a function`, async function () {
    const log = logger('test')
    log.info(() => ['message', 1])
    expect(logFunctionProvider.args[0].slice(1)).to.deep.equal(['message', 1])
  })
})
describe('log levels', () => {
  const logProvider = sinon.spy()

  beforeEach(() => {
    logProvider.resetHistory()
    setLogProvider(logProvider)
  })

  afterEach(() => {
    setLogProvider(defaultLogProvider)
  })

  it('trace-debug disabled by default', () => {
    const foo = logger('foo')

    foo.trace('a', 'b')
    foo.debug('a', 'b')
    expect(logProvider.args).to.deep.equal([])
  })
  it('info-fatal enabled by default', () => {
    const foo = logger('foo')

    foo.info('a', 'b')
    foo.warn('c')
    foo.error('d')
    foo.fatal('e')
    expect(logProvider.args).to.deep.equal([
      ['foo', LOG_LEVEL_INFO, 'a', 'b'],
      ['foo', LOG_LEVEL_WARN, 'c'],
      ['foo', LOG_LEVEL_ERROR, 'd'],
      ['foo', LOG_LEVEL_FATAL, 'e'],
    ])
  })
  it(`setLogLevel accepts all valid log levels`, function () {
    for (const level of levels) {
      setLogLevel('test', level)
    }
  })
  it(`setLogLevel rejects invalid log levels`, function () {
    for (const level of [LOG_LEVEL_TRACE - 1, LOG_LEVEL_FATAL + 1]) {
      expect(() => setLogLevel('test', level as any)).to.throw(
        `invalid log level: ${level}`
      )
    }
  })
  it(`logAtLevel`, function () {
    const log = logger('test')
    setLogLevel('test', LOG_LEVEL_TRACE)
    for (const level of levels) {
      logProvider.resetHistory()
      log.logAtLevel(level, 'a', 1)
      expect(logProvider.args).to.deep.equal([['test', level, 'a', 1]])
    }
  })
  it(`child log paths`, function () {
    const log = logger('foo.bar')
    log.debug('test')
    expect(logProvider.args).to.deep.equal([])

    logProvider.resetHistory()
    setLogLevel('foo', LOG_LEVEL_DEBUG)
    log.debug('test2')
    expect(logProvider.args).to.deep.equal([
      ['foo.bar', LOG_LEVEL_DEBUG, 'test2'],
    ])

    logProvider.resetHistory()
    logger('foo/bar').debug('test3')
    logger('foo:bar').debug('test4')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_DEBUG, 'test3'],
      ['foo:bar', LOG_LEVEL_DEBUG, 'test4'],
    ])

    logProvider.resetHistory()
    setLogLevel('foo', LOG_LEVEL_INFO)
    log.debug('test3')
    expect(logProvider.args).to.deep.equal([])

    logProvider.resetHistory()
    setLogLevel('foo.bar', LOG_LEVEL_DEBUG)
    log.debug('test4')
    expect(logProvider.args).to.deep.equal([
      ['foo.bar', LOG_LEVEL_DEBUG, 'test4'],
    ])
  })
  it(`patterns`, function () {
    setLogLevel('foo/*', LOG_LEVEL_TRACE)
    setLogLevel('foo', LOG_LEVEL_DEBUG)
    logger('foo/bar').trace('test')
    logger('foo').trace('test2')
    logger('foo').debug('test3')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
      ['foo', LOG_LEVEL_DEBUG, 'test3'],
    ])

    logProvider.resetHistory()
    setLogLevel('foo/*', LOG_LEVEL_DEBUG)
    setLogLevel('bar/*', LOG_LEVEL_TRACE)
    setLogLevel('qux/*', LOG_LEVEL_TRACE)
    logger('foo/bar').trace('test')
    logger('bar/baz').trace('test2')
    logger('qux/glorm').trace('test3')
    expect(logProvider.args).to.deep.equal([
      ['bar/baz', LOG_LEVEL_TRACE, 'test2'],
      ['qux/glorm', LOG_LEVEL_TRACE, 'test3'],
    ])

    logProvider.resetHistory()
    setLogLevel('*', LOG_LEVEL_TRACE)
    logger('foo/bar').trace('test')
    expect(logProvider.args).to.deep.equal([
      [
        'log4jcore',
        LOG_LEVEL_TRACE,
        'calcLogLevel("foo/bar"): TRACE (pattern, configured)',
      ],
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
    ])

    resetLogLevels()
    logProvider.resetHistory()
    setLogLevel('foo/*', LOG_LEVEL_DEBUG)
    setLogLevel('foo', LOG_LEVEL_TRACE)
    logger('foo/bar').trace('test')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
    ])
  })
  it(`env patterns`, function () {
    process.env.TRACE = 'foo/*'
    process.env.DEBUG = 'foo'
    envVarChanged('TRACE')
    envVarChanged('DEBUG')
    logger('foo/bar').trace('test')
    logger('foo').trace('test2')
    logger('foo').debug('test3')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
      ['foo', LOG_LEVEL_DEBUG, 'test3'],
    ])

    logProvider.resetHistory()
    process.env.DEBUG = 'foo/*'
    process.env.TRACE = 'bar/*,qux/*'
    envVarChanged('DEBUG')
    envVarChanged('TRACE')
    logger('foo/bar').trace('test')
    logger('bar/baz').trace('test2')
    logger('qux/glorm').trace('test3')
    expect(logProvider.args).to.deep.equal([
      ['bar/baz', LOG_LEVEL_TRACE, 'test2'],
      ['qux/glorm', LOG_LEVEL_TRACE, 'test3'],
    ])

    logProvider.resetHistory()
    process.env.TRACE = '*'
    envVarChanged('TRACE')
    logger('foo/bar').trace('test')
    expect(logProvider.args).to.deep.equal([
      ['log4jcore', LOG_LEVEL_TRACE, 'calcEnvLogLevels():'],
      ['log4jcore', LOG_LEVEL_TRACE, '  DEBUG: /^(foo\\/.*)$/'],
      ['log4jcore', LOG_LEVEL_TRACE, '  TRACE: /^(.*)$/'],
      [
        'log4jcore',
        LOG_LEVEL_TRACE,
        'calcLogLevel("foo/bar"): TRACE (pattern, env)',
      ],
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
    ])

    process.env.TRACE = 'foo'
    process.env.DEBUG = 'foo/*'
    resetLogLevels()
    logProvider.resetHistory()
    logger('foo/bar').trace('test')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_TRACE, 'test'],
    ])

    process.env.TRACE = ''
    process.env.DEBUG = 'foo/*'
    process.env.INFO = 'foo,foo/qux'
    resetLogLevels()
    logProvider.resetHistory()
    logger('foo/bar').debug('test')
    logger('foo/qux').debug('test2')
    expect(logProvider.args).to.deep.equal([
      ['foo/bar', LOG_LEVEL_DEBUG, 'test'],
      ['foo/qux', LOG_LEVEL_DEBUG, 'test2'],
    ])
  })
  it('self logging', function () {
    setLogLevel('log4jcore', LOG_LEVEL_TRACE)
    setLogLevel('foo', LOG_LEVEL_DEBUG)
    logger('foo.bar').debug('a')
    logger('foo').debug('b')
    logger('blah').debug('c')
    resetLogLevels()
    expect(logProvider.args).to.deep.equal([
      ['log4jcore', 1, 'setLogLevel("foo", 2 (DEBUG))'],
      [
        'log4jcore',
        1,
        'calcLogLevel("foo.bar"): DEBUG (at parent path: "foo", configured)',
      ],
      ['foo.bar', 2, 'a'],
      ['log4jcore', 1, 'calcLogLevel("foo"): DEBUG (exact path, configured)'],
      ['foo', 2, 'b'],
      ['log4jcore', 1, 'calcLogLevel("blah"): INFO (default)'],
      ['log4jcore', 1, 'resetLogLevels()'],
    ])
  })
})
describe(`memoryLogProvider`, function () {
  it(`works`, function () {
    const provider1 = memoryLogProvider()
    const provider2 = memoryLogProvider()
    const log = createLogger({
      loggerPath: 'test',
      logProviders: [provider1, provider2],
    })
    log.info('blah')
    log.error({ message: 'test' })
    expect(
      provider1.messages.map(pick(['loggerPath', 'level', 'args']))
    ).to.deep.equal([
      { loggerPath: 'test', level: LOG_LEVEL_INFO, args: ['blah'] },
      {
        loggerPath: 'test',
        level: LOG_LEVEL_ERROR,
        args: [{ message: 'test' }],
      },
    ])
    expect(
      provider2.messages.map(pick(['loggerPath', 'level', 'args']))
    ).to.deep.equal([
      { loggerPath: 'test', level: LOG_LEVEL_INFO, args: ['blah'] },
      {
        loggerPath: 'test',
        level: LOG_LEVEL_ERROR,
        args: [{ message: 'test' }],
      },
    ])
  })
})
describe(`inputLogProvider`, function () {
  it(`can be passed to another logger`, function () {
    const provider = memoryLogProvider()
    const downstream = createLogger({
      loggerPath: 'downstream',
      logProviders: [provider],
    })
    const upstream = createLogger({
      loggerPath: 'upstream',
      logProviders: [downstream.inputLogProvider],
    })
    upstream.info('blah')
    expect(
      provider.messages.map(pick(['loggerPath', 'level', 'args']))
    ).to.deep.equal([
      { loggerPath: 'downstream', level: LOG_LEVEL_INFO, args: ['blah'] },
    ])
  })
})
describe(`writableLogFunction`, function () {
  it(`works`, function () {
    const writable = new MemoryWritableStream()
    const log = createLogger({
      loggerPath: 'test',
      logProviders: [createDefaultLogProvider(writableLogFunction(writable))],
    })
    log.info('blah')
    log.error({ message: 'test' })
    expect(writable.toString()).to.match(
      /^\[[-0-9:. ]+test\] INFO blah\n\[[-0-9:. ]+test\] ERROR \{ message: 'test' \}\n$/
    )
  })
})

async function runEnvTest(
  env: Record<string, string>
): Promise<Record<string, string>> {
  const child = spawn(process.execPath, ['test/envVarEntrypoint.js'], {
    stdio: [0, 1, 2, 'ipc'],
    env,
  })
  const [message] = await Promise.all([
    emitted(child, 'message'),
    emitted(child, 'close'),
  ])
  return message
}

it(`sets log levels from env vars`, async function () {
  this.timeout(5000)
  expect(
    await runEnvTest({
      DEBUG: 'foo',
      TRACE: 'foo.bar,baz',
    })
  ).to.deep.equal({
    baz: LOG_LEVEL_TRACE,
    foo: LOG_LEVEL_DEBUG,
    'foo.bar': LOG_LEVEL_TRACE,
    'foo.baz': LOG_LEVEL_DEBUG,
    qux: LOG_LEVEL_INFO,
  })
})

it(`overrides the default log level with DEFAULT_LOG_LEVEL`, async function () {
  this.timeout(5000)
  expect(
    await runEnvTest({
      DEBUG: 'foo',
      TRACE: 'foo.bar,baz',
      DEFAULT_LOG_LEVEL: 'ERROR',
    })
  ).to.deep.equal({
    baz: LOG_LEVEL_TRACE,
    foo: LOG_LEVEL_DEBUG,
    'foo.bar': LOG_LEVEL_TRACE,
    'foo.baz': LOG_LEVEL_DEBUG,
    qux: LOG_LEVEL_ERROR,
  })
})
