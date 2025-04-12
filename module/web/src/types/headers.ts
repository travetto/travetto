import { Any, ByteRange, castTo } from '@travetto/runtime';
import { MimeType, MimeUtil } from '../util/mime.ts';

type Prim = number | boolean | string;
type HeaderValue = Prim | Prim[] | readonly Prim[];
export type WebHeadersInit = Headers | Record<string, undefined | null | HeaderValue> | [string, HeaderValue][];

const FILENAME_EXTRACT = /filename[*]?=["]?([^";]*)["]?/;

/**
 * Simple Headers wrapper with additional logic for common patterns
 */
export class WebHeaders extends Headers {

  #parsedType?: MimeType;

  constructor(o?: WebHeadersInit) {
    const passed = (o instanceof Headers);
    super(passed ? o : undefined);

    if (o && !passed) {
      for (const [k, v] of (Array.isArray(o) ? o : Object.entries(o))) {
        if (v !== undefined && v !== null) {
          this.append(k, castTo(v));
        }
      }
    }
  }

  /** Set if key not already set */
  setIfAbsent(key: string, value: string): void {
    if (!this.has(key)) {
      this.set(key, value);
    }
  }

  /**
   * Get a header value as a list, breaking on commas except for cookies
   */
  getList(key: string): string[] | undefined {
    const v = this.get(key);
    if (!v) {
      return;
    } else if (v.toLowerCase() === 'set-cookie') {
      return this.getSetCookie();
    }
    return v.split(key === 'cookie' ? /\s{0,3};\s{0,3}/ : /\s{0,3},\s{0,3}/);
  }

  // @ts-expect-error
  forEach(set: (v: string | string[], k: string, headers: WebHeaders) => void): void;
  forEach(set: (v: Any, k: string, headers: WebHeaders) => void): void;
  forEach(set: (v: string | string[], k: string, headers: WebHeaders) => void): void {
    for (const [k, v] of this.entries()) {
      set(k === 'set-cookie' ? this.getSetCookie() : v, k, this);
    }
  }

  /**
   * Vary a value
   */
  vary(value: string): void {
    this.append('Vary', value);
  }

  /**
   * Get the fully parsed content type
   */
  getContentType(): MimeType | undefined {
    return this.#parsedType ??= MimeUtil.parse(this.get('Content-Type')!);
  }

  /**
   * Read the filename from the content disposition
   */
  getFilename(): string | undefined {
    const [, match] = (this.get('Content-Disposition') ?? '').match(FILENAME_EXTRACT) ?? [];
    return match;
  }

  /**
   * Get requested byte range for a given request
   */
  getRange(chunkSize: number = 100 * 1024): ByteRange | undefined {
    const rangeHeader = this.get('Range');
    if (rangeHeader) {
      const [start, end] = rangeHeader.replace(/bytes=/, '').split('-')
        .map(x => x ? parseInt(x, 10) : undefined);
      if (start !== undefined) {
        return { start, end: end ?? (start + chunkSize) };
      }
    }
  }
}