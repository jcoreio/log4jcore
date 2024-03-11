import { Writable } from 'stream'
import util from 'util'

export default function writableLogFunction(
  writable: Writable
): (...args: any[]) => void {
  return (format: any, ...args: any[]): void => {
    writable.write(util.format(format, ...args) + '\n')
  }
}
