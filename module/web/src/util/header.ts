import { ByteRange, castKey, castTo } from '@travetto/runtime';

import { type Cookie } from '../types/cookie.ts';
import { WebHeaders } from '../types/headers.ts';

export type WebParsedHeader = { value: string, parameters: Record<string, string>, q?: number };

const SPLIT_EQ = /[ ]{0,10}=[ ]{0,10}/g;
const SPLIT_COMMA = /[ ]{0,10},[ ]{0,10}/;
const SPLIT_SEMI = /[ ]{0,10};[ ]{0,10}/g;
const QUOTE = '"'.charCodeAt(0);

/**
 * Web header utils
 */
export class WebHeaderUtil {

  /**
   * Parse cookie header
   */
  static parseCookieHeader(header: string): Cookie[] {
    const val = header.trim();
    return !val ? [] : val.split(SPLIT_SEMI).map(item => {
      const [name, value] = item.split(SPLIT_EQ);
      return { name, value };
    });
  }

  /**
   * Parse cookie set header
   */
  static parseSetCookieHeader(header: string): Cookie {
    const parts = header.split(SPLIT_SEMI);
    const [name, value] = parts[0].split(SPLIT_EQ);
    const c: Cookie = { name, value };
    for (const p of parts.slice(1)) {
      const [k, pv = ''] = p.toLowerCase().split(SPLIT_EQ);
      const v = pv.charCodeAt(0) === QUOTE ? pv.slice(1, -1) : pv;
      if (k === 'expires') {
        c[k] = new Date(v);
      } else {
        c[castKey(k)] = castTo(v || true);
      }
    }
    return c;
  }

  /**
   * Parse header segment
   * @input input
   */
  static parseHeaderSegment(input: string | null | undefined): WebParsedHeader {
    if (!input) {
      return { value: '', parameters: {} };
    }
    const [rv, ...parts] = input.split(SPLIT_SEMI);
    const item: WebParsedHeader = { value: '', parameters: {} };
    const value = rv.charCodeAt(0) === QUOTE ? rv.slice(1, -1) : rv;
    if (value.includes('=')) {
      parts.unshift(value);
    } else {
      item.value = value;
    }
    for (const part of parts) {
      const [k, pv = ''] = part.split(SPLIT_EQ);
      const v = (pv.charCodeAt(0) === QUOTE) ? pv.slice(1, -1) : pv;
      item.parameters[k] = v;
      if (k === 'q') {
        item.q = parseFloat(v);
      }
    }
    return item;
  }

  /**
   * Parse full header
   */
  static parseHeader(input: string): WebParsedHeader[] {
    const v = input.trim();
    if (!input) { return []; }
    return v.split(SPLIT_COMMA).map(x => this.parseHeaderSegment(x));
  }

  /**
   * Build cookie suffix
   */
  static buildCookieSuffix(c: Cookie): string[] {
    const parts = [];
    if (c.path) { parts.push(`path=${c.path}`); }
    if (c.expires) { parts.push(`expires=${c.expires.toUTCString()}`); }
    if (c.domain) { parts.push(`domain=${c.domain}`); }
    if (c.priority) { parts.push(`priority=${c.priority.toLowerCase()}`); }
    if (c.sameSite) { parts.push(`samesite=${c.sameSite.toLowerCase()}`); }
    if (c.secure) { parts.push('secure'); }
    if (c.httponly) { parts.push('httponly'); }
    if (c.partitioned) { parts.push('partitioned'); }
    return parts;
  }

  /**
   * Negotiate header
   */
  static negotiateHeader<K extends string>(header: string, values: K[]): K | undefined {
    if (header === '*' || header === '*/*') {
      return values[0];
    }
    const sorted = this.parseHeader(header.toLowerCase()).filter(x => (x.q ?? 1) > 0).toSorted((a, b) => (b.q ?? 1) - (a.q ?? 1));
    const set = new Set(values);
    for (const { value } of sorted) {
      const vk: K = castKey(value);
      if (value === '*') {
        return values[0];
      } else if (set.has(vk)) {
        return vk;
      }
    }
    return undefined;
  }

  /**
   * Get requested byte range for a given request
   */
  static getRange(headers: WebHeaders, chunkSize: number = 100 * 1024): ByteRange | undefined {
    if (!headers.has('Range')) {
      return;
    }
    const { parameters } = this.parseHeaderSegment(headers.get('Range'));
    if ('bytes' in parameters) {
      const [start, end] = parameters.bytes.split('-')
        .map(x => x ? parseInt(x, 10) : undefined);
      if (start !== undefined) {
        return { start, end: end ?? (start + chunkSize) };
      }
    }
  }

  /**
   * Check freshness of the response using request and response headers.
   */
  static isFresh(req: WebHeaders, res: WebHeaders): boolean {
    const cacheControl = req.get('Cache-Control');
    if (cacheControl?.includes('no-cache')) {
      return false;
    }

    const noneMatch = req.get('If-None-Match');
    if (noneMatch) {
      const etag = res.get('ETag');
      const validTag = (v: string): boolean => v === etag || v === `W/${etag}` || `W/${v}` === etag;
      return noneMatch === '*' || (!!etag && noneMatch.split(SPLIT_COMMA).some(validTag));
    } else {
      const modifiedSince = req.get('If-Modified-Since');
      const lastModified = res.get('Last-Modified');
      if (!modifiedSince || !lastModified) {
        return false;
      }
      const [a, b] = [Date.parse(lastModified), Date.parse(modifiedSince)];
      return !(Number.isNaN(a) || Number.isNaN(b)) && a >= b;
    }
  }
}