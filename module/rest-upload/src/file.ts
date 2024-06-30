import fs from 'node:fs/promises';
import { createReadStream, statSync } from 'node:fs';
import stream from 'node:stream';
import { ReadableStream } from 'node:stream/web';

export class LocalFile extends File {
  constructor(filename: string, contentType?: string) {
    super([], filename, { type: contentType });
    Object.defineProperty(this, 'size', {
      value: statSync(filename).size
    });
  }

  stream(): ReadableStream {
    return stream.Readable.toWeb(createReadStream(this.name));
  }

  text(): Promise<string> {
    return fs.readFile(this.name, 'utf8');
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return fs.readFile(this.name);
  }

  cleanup(): Promise<void> {
    return fs.rm(this.name, { force: true, recursive: true }).catch(() => { });
  }
}