import { type ByteRange, castKey, castTo } from '@travetto/runtime';

import { type Cookie } from '../types/cookie.ts';
import type { WebHeaders } from '../types/headers.ts';

export type WebParsedHeader = { value: string, parameters: Record<string, string>, q?: number };

const SPLIT_EQ = /[ ]{0,10}=[ ]{0,10}/g;
const SPLIT_COMMA = /[ ]{0,10},[ ]{0,10}/g;
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
    const text = header.trim();
    return !text ? [] : text.split(SPLIT_SEMI).map(item => {
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
    const result: Cookie = { name, value };
    for (const part of parts.slice(1)) {
      const [key, partValue = ''] = part.toLowerCase().split(SPLIT_EQ);
      const cleanedValue = partValue.charCodeAt(0) === QUOTE ? partValue.slice(1, -1) : partValue;
      if (key === 'expires') {
        result[key] = new Date(cleanedValue);
      } else {
        result[castKey(key)] = castTo(cleanedValue || true);
      }
    }
    return result;
  }

  /**
   * Parse header segment
   * @input input
   */
  static parseHeaderSegment(input: string | null | undefined): WebParsedHeader {
    if (!input) {
      return { value: '', parameters: {} };
    }
    const [rawValue, ...parts] = input.split(SPLIT_SEMI);
    const item: WebParsedHeader = { value: '', parameters: {} };
    const value = rawValue.charCodeAt(0) === QUOTE ? rawValue.slice(1, -1) : rawValue;
    if (value.includes('=')) {
      parts.unshift(value);
    } else {
      item.value = value;
    }
    for (const part of parts) {
      const [key, partValue = ''] = part.split(SPLIT_EQ);
      const cleanedValue = (partValue.charCodeAt(0) === QUOTE) ? partValue.slice(1, -1) : partValue;
      item.parameters[key] = cleanedValue;
      if (key === 'q') {
        item.q = parseFloat(cleanedValue);
      }
    }
    return item;
  }

  /**
   * Parse full header
   */
  static parseHeader(input: string): WebParsedHeader[] {
    const value = input.trim();
    if (!input) { return []; }
    return value.split(SPLIT_COMMA).map(part => this.parseHeaderSegment(part));
  }

  /**
   * Build cookie suffix
   */
  static buildCookieSuffix(cookie: Cookie): string[] {
    const parts = [];
    if (cookie.path) { parts.push(`path=${cookie.path}`); }
    if (cookie.expires) { parts.push(`expires=${cookie.expires.toUTCString()}`); }
    if (cookie.domain) { parts.push(`domain=${cookie.domain}`); }
    if (cookie.priority) { parts.push(`priority=${cookie.priority.toLowerCase()}`); }
    if (cookie.sameSite) { parts.push(`samesite=${cookie.sameSite.toLowerCase()}`); }
    if (cookie.secure) { parts.push('secure'); }
    if (cookie.httponly) { parts.push('httponly'); }
    if (cookie.partitioned) { parts.push('partitioned'); }
    return parts;
  }

  /**
   * Negotiate header
   */
  static negotiateHeader<K extends string>(header: string, values: K[]): K | undefined {
    if (header === '*' || header === '*/*') {
      return values[0];
    }
    const sorted = this.parseHeader(header.toLowerCase())
      .filter(item => (item.q ?? 1) > 0)
      .toSorted((a, b) => (b.q ?? 1) - (a.q ?? 1));

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
        .map(value => value ? parseInt(value, 10) : undefined);
      if (start !== undefined) {
        return { start, end: end ?? (start + chunkSize) };
      }
    }
  }

  /**
   * Check freshness of the response using request and response headers.
   */
  static isFresh(request: WebHeaders, response: WebHeaders): boolean {
    const cacheControl = request.get('Cache-Control');
    if (cacheControl?.includes('no-cache')) {
      return false;
    }

    const noneMatch = request.get('If-None-Match');
    if (noneMatch) {
      const etag = response.get('ETag');
      const validTag = (value: string): boolean => value === etag || value === `W/${etag}` || `W/${value}` === etag;
      return noneMatch === '*' || (!!etag && noneMatch.split(SPLIT_COMMA).some(validTag));
    } else {
      const modifiedSince = request.get('If-Modified-Since');
      const lastModified = response.get('Last-Modified');
      if (!modifiedSince || !lastModified) {
        return false;
      }
      const [a, b] = [Date.parse(lastModified), Date.parse(modifiedSince)];
      return !(Number.isNaN(a) || Number.isNaN(b)) && a >= b;
    }
  }
}