import { Renderable } from './renderable';
import { Response } from 'express';
import * as stream from 'stream';

export class StringResponse extends Renderable {
  constructor(public content: string) {
    super();
  }

  render(res: Response): void {
    res.send(this.content);
  }

  toStream(): NodeJS.ReadableStream {
    let out = new stream.Readable();
    (out as any)._read = function noop() { }; // redundant? see update below
    out.push(this.content);
    out.push(null);
    return out;
  }
}