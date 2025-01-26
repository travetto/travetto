import { SetOption } from 'cookies';
import { Response, Request, FilterContext } from './types';

export type RestCodecTransport = 'header' | 'cookie';

type Config = {
  cookie: string;
} | {
  header: string;
  headerPrefix?: string;
};

/**
 * Support for encoding/decoding a value from the rest context
 */
export class RestCodecValue {
  #headerName?: string;
  #cookieName?: string;
  #headerPrefix?: string;

  constructor(config: Config) {
    this.#headerName = 'header' in config ? config.header : undefined;
    this.#cookieName = 'cookie' in config ? config.cookie : undefined;
    this.#headerPrefix = 'headerPrefix' in config ? config.headerPrefix : undefined;
  }

  /**
   * Write to Response
   * @param res
   * @param value
   */
  writeValue(res: Response, value: string | undefined, cookieArgs: SetOption = {}): void {
    if (this.#cookieName) {
      res.cookies.set(this.#cookieName, value, {
        ...cookieArgs,
        maxAge: (cookieArgs.expires && value !== undefined) ? undefined : -1,
      });
    }
    if (value && this.#headerName) {
      res.setHeader(this.#headerName, this.#headerPrefix ? `${this.#headerPrefix} ${value}` : value);
    }
  }

  /**
   * Read form request
   * @param req
   */
  readValue(req: Request): string | undefined {
    return (this.#cookieName ? req.cookies.get(this.#cookieName) : undefined) ??
      (this.#headerName ? req.headerFirst(this.#headerName)?.split(this.#headerPrefix!).pop()?.trim() : undefined);
  }
}

/**
 * Codec for rest operations
 */
export interface RestCodec<T> {
  /**
   * Encode data
   * @param ctx The travetto filter context
   */
  encode(ctx: FilterContext, data: T | undefined): Promise<void> | void;
  /**
   * Read data
   * @param ctx The travetto filter context
   */
  decode(ctx: FilterContext): Promise<T | undefined> | T | undefined;
}