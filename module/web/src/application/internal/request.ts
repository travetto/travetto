import { IncomingHttpHeaders } from 'node:http';
import { PassThrough, Readable } from 'node:stream';

import { ByteRange, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { HttpRequest, HttpContentType } from '../../types';
import { MimeUtil } from '../../util/mime';
import { WebSymbols } from '../../symbols';

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * Base Http Request object
 */
export class HttpRequestCore implements Partial<HttpRequest> {
  /**
   * Content type parsed
   */
  [WebSymbols.ParsedType]?: HttpContentType;

  /**
   * Get the inbound request header as a string
   * @param key The header to get
   */
  header<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string | string[] | undefined {
    return this.headers[castTo<string>(key).toLowerCase()];
  }
  /**
   * Get the inbound request header as a string[]
   * @param key The header to get
   */
  headerList<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string[] | undefined {
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
  headerFirst<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string | undefined {
    return this.headerList(key)?.[0];
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(this: HttpRequest): HttpContentType | undefined {
    const self: HttpRequest & Partial<HttpRequestCore> = castTo(this);
    return self[WebSymbols.ParsedType] ??= MimeUtil.parse(this.headerFirst('content-type'));
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(this: HttpRequest): string | undefined {
    const self: HttpRequest & Partial<HttpRequestCore> = castTo(this);
    const raw = self[WebSymbols.NodeEntity];
    return self.headerFirst('x-forwarded-for') || raw.socket.remoteAddress;
  }

  /**
   * Get requested byte range for a given request
   */
  getRange(this: HttpRequest, chunkSize: number = 100 * 1024): ByteRange | undefined {
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
  getFilename(this: HttpRequest): string | undefined {
    const [, match] = (this.header('content-disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    return match;
  }

  /**
   * Get the expanded query object
   */
  getExpandedQuery(this: HttpRequest): Record<string, unknown> {
    return (this[WebSymbols.QueryExpanded] ??= BindUtil.expandPaths(this.query));
  }

  /**
   * Get request body as a stream
   */
  stream(this: HttpRequest): Readable {
    const out = new PassThrough();
    this.pipe(out);
    return out;
  }
}
