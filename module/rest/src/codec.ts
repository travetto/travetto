import { SetOption } from 'cookies';
import { Response, Request, FilterContext } from './types';
import { castTo } from '@travetto/runtime';

export type RestCodecTransport = 'header' | 'cookie';

type Config = ({
  cookie: string;
} | {
  header: string;
  headerPrefix?: string;
});

/**
 * Support for encoding/decoding a value from the rest context
 */
export class RestCodecValue<T> {
  #headerName?: string;
  #cookieName?: string;
  #headerPrefix?: string;

  constructor(config: Config) {
    this.#headerName = 'header' in config ? config.header : undefined;
    this.#cookieName = 'cookie' in config ? config.cookie : undefined;
    this.#headerPrefix = 'headerPrefix' in config ? config.headerPrefix : undefined;
  }

  /**
   * Write to response
   */
  writeValue(res: Response, value: T | undefined, cookieArgs: SetOption = {}): void {
    const output: string = value ? Buffer.from(JSON.stringify(value), 'utf8').toString('base64url') : castTo(value);

    if (this.#cookieName) {
      res.cookies.set(this.#cookieName, output, {
        ...cookieArgs,
        maxAge: (cookieArgs.expires && output !== undefined) ? undefined : -1,
      });
    }
    if (output && this.#headerName) {
      res.setHeader(this.#headerName, this.#headerPrefix ? `${this.#headerPrefix} ${output}` : output);
    }
  }

  /**
   * Read from request
   */
  readValue(req: Request): T | undefined {
    const input = (this.#cookieName ? req.cookies.get(this.#cookieName) : undefined) ??
      (this.#headerName ? req.headerFirst(this.#headerName)?.split(this.#headerPrefix!).pop()?.trim() : undefined);
    try {
      return input ? JSON.parse(Buffer.from(input, 'base64url').toString('utf8')) : input;
    } catch {
      return;
    }
  }
}

/**
 * Codec for rest operations
 */
export interface RestCodec<T> {
  /**
   * Encode data
   */
  encode(ctx: FilterContext, data: T | undefined): Promise<void> | void;
  /**
   * Decode data
   */
  decode(ctx: FilterContext): Promise<T | undefined> | T | undefined;
}