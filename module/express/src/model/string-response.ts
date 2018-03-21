import { Renderable } from './renderable';
import { Response } from 'express';
import * as stream from 'stream';

export class StringResponse implements Renderable {
  constructor(public content: string) {
  }

  render(res: Response): void {
    res.send(this.content);
  }

  toStream(): NodeJS.ReadableStream {
    const out = new stream.Readable();
    (out as any)._read = function noop() { }; // redundant? see update below
    out.push(this.content);
    out.push(null);
    return out;
  }
}