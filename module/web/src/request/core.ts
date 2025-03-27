import { IncomingHttpHeaders } from 'node:http';

import { asFull, ByteRange, castTo } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { HttpContact, HttpRequest, MimeType, WebInternal } from '../types.ts';
import { MimeUtil } from '../util/mime.ts';
import { HttpPayload } from '../response/payload.ts';

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * Base Http Request object
 */
export class HttpRequestCore implements Partial<HttpRequest> {

  /**
   * Decorate a given request, extending from the request core
   */
  static create<T extends HttpRequest>(req: Partial<T>, contact: HttpContact): T {
    if ('redirect' in req) {
      delete req.redirect;
    }
    Object.setPrototypeOf(req, HttpRequestCore.prototype);
    req.path ??= (req.url ?? '').split(/[#?]/g)[0].replace(/^[^/]/, (a) => `/${a}`);
    req.method = castTo(req.method?.toUpperCase());
    castTo<{ connection: unknown }>(req).connection = {};
    Object.assign((req[WebInternal] ??= asFull({}))!, { createdDate: Date.now(), contact });
    return asFull<T>(req);
  }

  /**
   * Get the inbound request header as a string
   * @param key The header to get
   */
  getHeader<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string | string[] | undefined {
    return this.headers[castTo<string>(key).toLowerCase()];
  }
  /**
   * Get the inbound request header as a string[]
   * @param key The header to get
   */
  getHeaderList<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string[] | undefined {
    const res = this.getHeader(key);
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
  getHeaderFirst<K extends keyof IncomingHttpHeaders>(this: HttpRequest, key: K): string | undefined {
    return this.getHeaderList(key)?.[0];
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(this: HttpRequest): MimeType | undefined {
    return this[WebInternal].parsedType ??= MimeUtil.parse(this.getHeaderFirst('content-type'));
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(this: HttpRequest): string | undefined {
    const raw = this[WebInternal].contact.nodeReq;
    return this.getHeaderFirst('x-forwarded-for') || raw.socket.remoteAddress;
  }

  /**
   * Get requested byte range for a given request
   */
  getRange(this: HttpRequest, chunkSize: number = 100 * 1024): ByteRange | undefined {
    const rangeHeader = this.getHeaderFirst('range');

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
    const [, match] = (this.getHeader('content-disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    return match;
  }

  /**
   * Get the expanded query object
   */
  getExpandedQuery(this: HttpRequest): Record<string, unknown> {
    return this[WebInternal].queryExpanded ??= BindUtil.expandPaths(this.query);
  }

  /**
   * End response immediately
   * @private
   */
  endResponse(this: HttpRequest): void {
    this[WebInternal].contact.takeControlOfResponse?.();
    this[WebInternal].contact.nodeRes.flushHeaders();
  }
}
