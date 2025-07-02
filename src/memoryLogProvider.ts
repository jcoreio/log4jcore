import { Level, LogProvider } from './index'

export type MemoryLogMessage = {
  loggerPath: string
  level: Level
  time: number

  args: any[]
}

export interface MemoryLogProvider extends LogProvider {
  (loggerPath: string, level: Level, ...args: Array<any>): void
  messages: MemoryLogMessage[]
}

export default function memoryLogProvider(): MemoryLogProvider {
  const messages: MemoryLogMessage[] = []
  const result: MemoryLogProvider = (
    loggerPath: string,
    level: Level,

    ...args: any[]
  ): void => {
    messages.push({ loggerPath, level, time: Date.now(), args })
  }
  result.messages = messages
  return result
}
