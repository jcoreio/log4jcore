/* eslint-disable  @typescript-eslint/no-var-requires,  @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any */

import path from 'path'
import { execSync } from 'child_process'
import touch from 'touch'
import glob from 'glob'

const Promake = require('promake')

const promake = new Promake()

process.chdir(__dirname)
const pathDelimiter = /^win/.test(process.platform) ? ';' : ':'
const npmBin = execSync(`npm bin`)
  .toString('utf8')
  .trim()
process.env.PATH = process.env.PATH
  ? `${npmBin}${pathDelimiter}${process.env.PATH}`
  : npmBin

const { rule, task, exec, cli } = promake

const spawn = (command: string, args?: Array<string>, options?: any) => {
  if (!Array.isArray(args)) {
    options = args
    args = []
  }
  if (!args) args = []
  if (!options) options = {}
  return promake.spawn(command, args, {
    stdio: 'inherit',
    ...options,
  })
}

rule('node_modules', ['package.json', 'yarn.lock'], async () => {
  await exec('yarn --ignore-scripts')
  await touch('node_modules')
})

function env /* ...names */() /* : {[name: string]: ?string} */ {
  /* : Array<string> */
  return {
    ...process.env,
    //...require('defaultenv')(names.map(name => `env/${name}.js`), {noExport: true}),
    ...require('defaultenv')([], { noExport: true }),
  }
}

const tsFiles = glob.sync('src/**.ts')
const jsFlowFiles = glob.sync('src/**.js.flow')

const outJsFiles = tsFiles.map(f =>
  path.relative('src', f.replace(/\.ts$/, '.js'))
)
const outDtsFiles = tsFiles.map(f =>
  path.relative('src', f.replace(/\.ts$/, '.d.ts'))
)
const outJsFlowFiles = jsFlowFiles.map(f => path.relative('src', f))

task('clean', () =>
  spawn('rm -rf *.js *.d.ts *.js.flow', [], { shell: true })
).description('remove build output')

rule(outJsFiles, [...tsFiles, 'node_modules'], () =>
  spawn('babel', [
    'src',
    '--out-dir',
    '.',
    '--extensions',
    '.ts,.tsx',
    '--source-maps',
    'inline',
  ])
)
task('build:js', outJsFiles)

rule(outJsFlowFiles, jsFlowFiles, () =>
  spawn(`cp -p src/*.js.flow .`, [], { shell: true })
)

rule(outDtsFiles, [...tsFiles, 'node_modules'], () =>
  spawn('tsc', ['--emitDeclarationOnly'])
)
task('build:types', [...outDtsFiles, ...outJsFlowFiles])

// Just transpile from src to lib
task('build', [task('clean'), task('build:js'), task('build:types')])

task('types', 'node_modules', () => spawn('tsc', ['--noEmit'])).description(
  'check files with TypeScript'
)

const lintFiles = ['run.ts', 'src/**/*.ts', 'test/**/*.js', 'test/**/*.ts']

task('lint', ['node_modules'], () =>
  spawn('eslint', [...lintFiles, '--cache'])
).description('check files with eslint')
task('lint:fix', 'node_modules', () =>
  spawn('eslint', ['--fix', ...lintFiles, '--cache'])
).description('fix eslint errors automatically')
task('lint:watch', 'node_modules', () =>
  spawn('esw', ['-w', ...lintFiles, '--changed', '--cache'])
).description('run eslint in watch mode')

function testRecipe(options: {
  coverage?: boolean
  watch?: boolean
  debug?: boolean
}): (rule: { args: Array<string> }) => Promise<void> {
  const { coverage, watch, debug } = options
  const args = ['./test/configure.js']
  if (watch) args.push('./test/clearConsole.js')

  args.push('./test/**/*.ts')
  if (watch) args.push('--watch')
  if (debug) args.push('--inspect-brk')
  let command = 'mocha'
  if (coverage) {
    args.unshift('--reporter=lcov', '--reporter=text', command)
    command = 'nyc'
  }

  return rule =>
    spawn(command, [...args, ...rule.args], {
      env: {
        BABEL_ENV: coverage ? 'coverage' : 'test',
        ...env(),
      },
      stdio: 'inherit',
    })
}

for (const coverage of [false, true]) {
  const prefix = coverage ? 'coverage' : 'test'
  for (const watch of coverage ? [false] : [false, true]) {
    for (const debug of watch ? [false] : [false, true]) {
      const suffix = watch ? ':watch' : debug ? ':debug' : ''
      task(
        `${prefix}${suffix}`,
        ['node_modules'],
        testRecipe({ coverage, watch, debug })
      ).description(
        `run tests${coverage ? ' with code coverage' : ''}${
          watch ? ' in watch mode' : ''
        }${debug ? ' in debug mode' : ''}`
      )
    }
  }
}

for (const fix of [false, true]) {
  task(fix ? 'prep' : 'check', [
    task(`lint${fix ? ':fix' : ''}`),
    task('types'),
    task('test'),
  ]).description(
    `run all checks${fix ? ', automatic fixes,' : ''} and unit tests`
  )
}

task('open:coverage', () => {
  require('opn')('coverage/lcov-report/index.html')
}).description('open test coverage output')

cli()
