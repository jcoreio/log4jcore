import { describe, it } from 'mocha'
import { expect } from 'chai'
import { spawn } from 'child_process'
import { pick } from 'lodash/fp'
import Path from 'path'
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
} from '../src'
import sinon from 'sinon'
import memoryLogProvider from '../src/memoryLogProvider'
import writableLogFunction from '../src/writableLogFunction'
import MemoryWritableStream from './MemoryWritableStream'

const levels: Level[] = [
  LOG_LEVEL_TRACE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_FATAL,
]

describe(`defaultLogProvider`, function() {
  const logFunctionProvider = sinon.spy()

  beforeEach(() => {
    resetLogLevels()
    logFunctionProvider.resetHistory()
    setLogProvider(defaultLogProvider)
    setLogFunctionProvider(() => logFunctionProvider)
  })

  afterEach(() => {
    setLogFunctionProvider(defaultLogFunctionProvider)
  })

  it(`formats date correctly`, function() {
    const log = logger('test')
    log.info('message', 1)
    expect(logFunctionProvider.args[0][0]).to.match(
      /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3} test\] INFO$/
    )
  })
  it(`passes remaining args`, async function() {
    const log = logger('test')
    log.info('message', 1)
    expect(logFunctionProvider.args[0].slice(1)).to.deep.equal(['message', 1])
  })
  it(`passes remaining args when logging with a function`, async function() {
    const log = logger('test')
    log.info(() => ['message', 1])
    expect(logFunctionProvider.args[0].slice(1)).to.deep.equal(['message', 1])
  })
})
describe('log levels', () => {
  const logProvider = sinon.spy()

  beforeEach(() => {
    resetLogLevels()
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
  it(`setLogLevel accepts all valid log levels`, function() {
    for (const level of levels) {
      setLogLevel('test', level)
    }
  })
  it(`setLogLevel rejects invalid log levels`, function() {
    for (const level of [LOG_LEVEL_TRACE - 1, LOG_LEVEL_FATAL + 1]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => setLogLevel('test', level as any)).to.throw(
        `invalid log level: ${level}`
      )
    }
  })
  it(`logAtLevel`, function() {
    const log = logger('test')
    setLogLevel('test', LOG_LEVEL_TRACE)
    for (const level of levels) {
      logProvider.resetHistory()
      log.logAtLevel(level, 'a', 1)
      expect(logProvider.args).to.deep.equal([['test', level, 'a', 1]])
    }
  })
  it(`child log paths`, function() {
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
})
describe(`memoryLogProvider`, function() {
  it(`works`, function() {
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
describe(`inputLogProvider`, function() {
  it(`can be passed to another logger`, function() {
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
describe(`writableLogFunction`, function() {
  it(`works`, function() {
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
  const child = spawn(
    process.execPath,
    [Path.resolve(__dirname, 'envVarEntrypoint.js')],
    {
      stdio: [0, 1, 2, 'ipc'],
      env,
    }
  )
  const [message] = await Promise.all([
    emitted(child, 'message'),
    emitted(child, 'close'),
  ])
  return message
}

it(`sets log levels from env vars`, async function() {
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

it(`overrides the default log level with DEFAULT_LOG_LEVEL`, async function() {
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
