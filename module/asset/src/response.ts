import { Readable } from 'node:stream';
import path from 'node:path/trv';

import { StreamMeta, StreamRange } from '@travetto/model';
import { TypedObject } from '@travetto/base';

const FIELD_TO_HEADER: Record<keyof StreamMeta, string> = {
  contentType: 'content-type',
  contentEncoding: 'content-encoding',
  cacheControl: 'cache-control',
  contentLanguage: 'content-language',
  size: 'content-length',
  hash: '',
  filename: '',
  title: ''
};

/**
 * A stream response
 */
export class StreamResponse {

  /**
   * Request to begin streaming
   */
  stream: () => Readable;
  /**
   * Response byte range, inclusive
   */
  range?: Required<StreamRange>;
  /**
   * Stream meta
   */
  meta: StreamMeta;

  constructor(stream: () => Readable, meta: StreamMeta, range?: Required<StreamRange>) {
    this.stream = stream;
    this.meta = meta;
    this.range = range;
  }

  statusCode(): number {
    return this.range ? 206 : 200;
  }

  headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [f, v] of TypedObject.entries(FIELD_TO_HEADER)) {
      if (this.meta[f] && v) {
        headers[v] = `${this.meta[f]}`;
      }
    }
    if (this.meta.filename) {
      headers['content-disposition'] = `attachment;filename=${path.basename(this.meta.filename)}`;
    }
    if (this.range) {
      headers['accept-ranges'] = 'bytes';
      headers['content-range'] = `bytes ${this.range.start}-${this.range.end}/${this.meta.size}`;
      headers['content-length'] = `${this.range.end - this.range.start + 1}`;
    }
    return headers;
  }

  render(): Readable {
    return this.stream();
  }
}