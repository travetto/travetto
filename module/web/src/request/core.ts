import { IncomingHttpHeaders } from 'node:http';
import { PassThrough, Readable } from 'node:stream';

import { asFull, ByteRange, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { HttpRequest, HttpContentType, WebInternal } from '../types.ts';
import { MimeUtil } from '../util/mime.ts';

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * Base Http Request object
 */
export class HttpRequestCore implements Partial<HttpRequest> {

  /**
   * Decorate a given request, extending from the request core
   */
  static create<T extends HttpRequest>(req: Partial<T> & { connection?: unknown }): T {
    if ('redirect' in req) {
      delete req.redirect;
    }
    Object.setPrototypeOf(req, HttpRequestCore.prototype);
    req.path ??= (req.url ?? '').split(/[#?]/g)[0].replace(/^[^/]/, (a) => `/${a}`);
    req.method = castTo(req.method?.toUpperCase());
    req.connection = {};
    req[WebInternal]!.createdDate = Date.now();
    return asFull<T>(req);
  }

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
    return this[WebInternal].parsedType ??= MimeUtil.parse(this.headerFirst('content-type'));
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(this: HttpRequest): string | undefined {
    const raw = this[WebInternal].nodeEntity;
    return this.headerFirst('x-forwarded-for') || raw.socket.remoteAddress;
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
    return this[WebInternal].queryExpanded ??= BindUtil.expandPaths(this.query);
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
