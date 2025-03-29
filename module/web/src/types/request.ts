import { IncomingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';

import { Any, AppError, ByteRange } from '@travetto/runtime';
import { BindUtil } from '@travetto/schema';

import { HttpMetadataConfig } from './common.ts';
import { MimeUtil } from '../util/mime.ts';
import { HttpHeaderMap, HttpHeaders } from './headers.ts';
import { HttpResponse } from './response.ts';
import { CookieReadOptions } from './cookie.ts';

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

type MimeType = { type: string, subtype: string, full: string, parameters: Record<string, string> };

type RequestInit = {
  headers: IncomingHttpHeaders | HttpHeaderMap | HttpHeaders;
  method: string;
  protocol: 'http' | 'https';
  port?: number;
  query: Record<string, unknown>;
  path: string;
  params?: Record<string, string>;
  respond: (value: HttpResponse) => void;
  body?: unknown;
  inputStream?: Readable;
  remoteIp?: string;
  getCookie?: (key: string, opts: CookieReadOptions) => string | undefined;
};

export interface HttpRequestInternal {
  requestParams?: unknown[];
}

/**
 * Base Http Request object
 */
export class HttpRequest {

  #parsedType?: MimeType;
  #queryExpanded?: Record<string, unknown>;
  #internal: HttpRequestInternal = {};

  readonly headers: HttpHeaders;
  readonly path: string;
  readonly port: number;
  readonly method: string;
  readonly query: Record<string, unknown>;
  readonly params: Record<string, string>;
  readonly remoteIp?: string;
  readonly inputStream: Readable;
  readonly respond: (value: HttpResponse) => void;
  body?: Any;

  constructor(init: RequestInit) {
    Object.assign(this, init);
    this.headers = init.headers instanceof HttpHeaders ? init.headers : new HttpHeaders(init.headers);
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(this: HttpRequest): MimeType | undefined {
    return this.#parsedType ??= MimeUtil.parse(this.headers.get('Content-Type'));
  }

  /**
   * Attempt to read the remote IP address of the connection
   */
  getIp(): string | undefined {
    return this.headers.get('X-Forwarded-For') || this.remoteIp;
  }

  /**
   * Get requested byte range for a given request
   */
  getRange(this: HttpRequest, chunkSize: number = 100 * 1024): ByteRange | undefined {
    const rangeHeader = this.headers.get('Range');

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
    const [, match] = (this.headers.get('Content-Disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    return match;
  }

  /**
   * Get the expanded query object
   */
  getExpandedQuery(this: HttpRequest): Record<string, unknown> {
    return this.#queryExpanded ??= BindUtil.expandPaths(this.query);
  }

  /**
   * Read value from request
   */
  readMetadata(this: HttpRequest, cfg: HttpMetadataConfig, opts?: CookieReadOptions): string | undefined {
    let res = (cfg.mode === 'cookie' || !cfg.mode) ?
      this.getCookie(cfg.cookie, opts) :
      this.headers.get(cfg.header);

    if (res && cfg.mode === 'header' && cfg.headerPrefix) {
      res = res.split(cfg.headerPrefix)[1].trim();
    }

    return res;
  }

  getInternal(): HttpRequestInternal {
    return this.#internal;
  }

  getCookie(key: string, opts?: CookieReadOptions): string | undefined {
    throw new AppError('Cannot access cookies without establishing read support', { category: 'general' });
  }
}
