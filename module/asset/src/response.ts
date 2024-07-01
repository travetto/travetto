import { Readable } from 'node:stream';

import { StreamMeta, StreamRange } from '@travetto/model';
import { path } from '@travetto/manifest';

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
    headers['content-type'] = this.meta.contentType;
    if (this.meta.filename) {
      headers['content-disposition'] = `attachment;filename=${path.basename(this.meta.filename)}`;
    }
    if (this.meta.contentEncoding) {
      headers['content-encoding'] = this.meta.contentEncoding;
    }
    if (this.meta.contentLanguage) {
      headers['content-language'] = this.meta.contentLanguage;
    }
    if (this.meta.cacheControl) {
      headers['cache-control'] = this.meta.cacheControl;
    }
    if (!this.range) {
      headers['content-length'] = `${this.meta.size}`;
    } else {
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