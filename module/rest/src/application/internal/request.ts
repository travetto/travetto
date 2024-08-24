import { IncomingHttpHeaders } from 'node:http';
import { PassThrough, Readable } from 'node:stream';

import { ByteRange, castTo } from '@travetto/runtime';

import { Request, ContentType } from '../../types';
import { MimeUtil } from '../../util/mime';
import { NodeEntityⲐ, ParsedTypeⲐ } from '../../internal/symbol';

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * Base Request object
 */
export class RequestCore implements Partial<Request> {
  /**
   * Content type parsed
   */
  [ParsedTypeⲐ]?: ContentType;

  /**
   * Get the inbound request header as a string
   * @param key The header to get
   */
  header<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string | string[] | undefined {
    return this.headers[castTo<string>(key).toLowerCase()];
  }
  /**
   * Get the inbound request header as a string[]
   * @param key The header to get
   */
  headerList<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string[] | undefined {
    const res = this.header(key);
    if (res === undefined) {
      return res;
    }
    return typeof res === 'string' ?
      res.split(
        /set-cookie/i.test(key.toString()) ?
          /\s*;\s*/ : /\s*,\s*/
      ) : res;
  }

  /**
   * Get the inbound request header first value
   * @param key The header to get
   */
  headerFirst<K extends keyof IncomingHttpHeaders>(this: Request, key: K): string | undefined {
    return this.headerList(key)?.[0];
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(this: Request): ContentType | undefined {
    const self: Request & Partial<RequestCore> = castTo(this);
    return self[ParsedTypeⲐ] ??= MimeUtil.parse(this.headerFirst('content-type'));
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(this: Request): string | undefined {
    const self: Request & Partial<RequestCore> = castTo(this);
    const raw = self[NodeEntityⲐ];
    return self.headerFirst('x-forwarded-for') || raw.socket.remoteAddress;
  }

  /**
   * Get requested byte range for a given request
   */
  getRange(this: Request, chunkSize: number = 100 * 1024): ByteRange | undefined {
    const rangeHeader = this.headerFirst('range');

    if (rangeHeader) {
      const [start, end] = rangeHeader.replace(/bytes=/, '').split('-')
        .map(x => x ? parseInt(x, 10) : undefined);
      if (start !== undefined) {
        return { start, end: end ?? (start + chunkSize) };
      }
    }
  }

  /**
   * Read the filename from the content disposition
   */
  getFilename(this: Request): string {
    const [, match] = (this.header('content-disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    if (match) {
      return match;
    } else {
      return `unknown_${Date.now()}`;
    }
  }

  /**
   * Get request body as a stream
   */
  stream(this: Request): Readable {
    const out = new PassThrough();
    this.pipe(out);
    return out;
  }
}
