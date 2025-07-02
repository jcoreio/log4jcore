import { Writable } from 'stream'

export default class MemoryWritableStream extends Writable {
  _chunks: Buffer[] = []

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (err?: Error) => unknown
  ): void {
    this._chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    )
    callback()
  }

  toBuffer(): Buffer {
    return Buffer.concat(this._chunks)
  }

  toString(): string {
    return this.toBuffer().toString()
  }
}
