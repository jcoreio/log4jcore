import { Level, LogProvider } from './index'

export type MemoryLogMessage = {
  loggerPath: string
  level: Level
  time: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
}

export interface MemoryLogProvider extends LogProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (loggerPath: string, level: Level, ...args: Array<any>): void
  messages: MemoryLogMessage[]
}

export default function memoryLogProvider(): MemoryLogProvider {
  const messages: MemoryLogMessage[] = []
  const result: MemoryLogProvider = (
    loggerPath: string,
    level: Level,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ): void => {
    messages.push({ loggerPath, level, time: Date.now(), args })
  }
  result.messages = messages
  return result
}
