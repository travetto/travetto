import { Readable, PassThrough } from 'node:stream';
import { isPromise } from 'node:util/types';

import { BinaryUtil, type BinaryMetadata, type BinaryType } from './binary.ts';

export class BinaryFile extends File {

  #source: BinaryType | (() => (BinaryType | Promise<BinaryType>));

  constructor(source: BinaryType | (() => (BinaryType | Promise<BinaryType>))) {
    super([], ''); // We just need the inheritance, not the actual Blob constructor behavior
    this.#source = source;
  }

  get size(): number {
    const meta = BinaryUtil.getMetadata(this);
    return (meta.range ? (meta.range.end - meta.range.start) + 1 : meta.size) ?? 0;
  }

  get type(): string {
    const meta = BinaryUtil.getMetadata(this);
    return meta.contentType ?? '';
  }

  get source(): BinaryType {
    const value = (typeof this.#source === 'function') ? this.#source() : this.#source;
    if (isPromise(value)) {
      const stream = new PassThrough();
      value.then(source => BinaryUtil.pipeline(source, stream)).catch(error => stream.destroy(error));
      return stream;
    } else {
      return value;
    }
  }

  get filename(): string {
    const meta = BinaryUtil.getMetadata(this);
    return meta.filename ?? meta.rawLocation ?? '';
  }

  updateMetadata(metadata: BinaryMetadata): this {
    BinaryUtil.setMetadata(this, {
      ...BinaryUtil.getMetadata(this),
      ...metadata
    });
    return this;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return BinaryUtil.toBuffer(this.source).then(buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  }

  bytes(): Promise<NodeJS.NonSharedUint8Array> {
    return BinaryUtil.toBinaryArray(this.source).then(buffer => new Uint8Array(buffer));
  }

  slice(start?: number, end?: number, _contentType?: string): Blob {
    return new BinaryFile(async () => {
      const buffer = await BinaryUtil.toBinaryArray(this.source);
      return BinaryUtil.sliceByteArray(buffer, start ?? 0, end);
    }).updateMetadata({
      range: {
        start: start ?? 0,
        end: (end !== undefined ? end : this.size) - 1
      }
    });
  }

  stream(): ReadableStream<NodeJS.NonSharedUint8Array> {
    const readable = BinaryUtil.toReadable(this.source);
    return Readable.toWeb(readable);
  }

  text(): Promise<string> {
    return BinaryUtil.toBuffer(this.source).then(buffer => buffer.toString('utf8'));
  }
}
