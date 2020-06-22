# log4jcore

log4jcore

## Installation

```sh
yarn add log4jcore
```

## Usage

```typescript
import { logger } from 'log4jcore'

const log = logger('MyClass')

log.info('starting application')

// Multiple arguments are supported, like with console.log. 
// One benefit of this approach is that arguments are not 
// stringified unless the log level requires the message to be
// logged.
log.info('ip address:', process.env.IP_ADDRESS)

// Use arrow functions to avoid computing a message unless the
// log level requires it to be logged.
log.debug(() => `hostname: ${process.env.HOSTNAME}`)
```

### Configuring Log Levels

Log levels are set to `info` by default. To change the log level
for a logger, pass in an environment variable like `DEBUG=MyClass`. 

Valid environment variable names are:
- `TRACE`
- `DEBUG`
- `INFO`
- `WARN`
- `ERROR`
- `FATAL`

To change the log levels of multiple loggers, use a comma separated list of logger
names, like `DEBUG=MyClass,AnotherClass`.

### Changing Appenders

The default appender calls `console.log` if the message
severity is `WRAN` or lower, and calls `console.error` if the message severity
is `ERROR` or higher.

`setLogFunctionProvider` allows you to override this and replace the log writer
with a different one. This can be useful if you want to log to a file or log to 
an external logging API.

#### Logging to a file using `log4jcore-file-appender`:

`log4jcore-file-appender` is a simple logging provider that writes to a file instead
of stdout / stderr. At the time of this writing, it does not have TypeScript type defs
although it does have Flow Type defs.

```sh
yarn add log4jcore-file-appender
```

```js
const { setLogFunctionProvider } = require('log4jcore')
const { createFileAppender } = require('log4jcore-file-appender')

setLogFunctionProvider(createFileAppender({ file: 'messages.log' }))
```
