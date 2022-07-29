import { SetOption } from 'cookies';
import { Response, Request } from '../types';

/**
 * Utils for context encoding
 */
export class ValueAccessor {
  #name: string;
  #location: 'header' | 'cookie';

  constructor(name: string, location: 'header' | 'cookie') {
    this.#name = name;
    this.#location = location;
  }

  /**
   * Write to Response
   * @param res
   * @param token
   */
  writeValue(res: Response, token: string | null, cookieArgs: SetOption = {}): void {
    if (this.#location === 'cookie') {
      res.cookies.set(this.#name, token, {
        ...cookieArgs,
        maxAge: cookieArgs.expires ? undefined : -1,
      });
    } else if (token) {
      res.setHeader(this.#name, token);
    }
  }

  /**
   * Read form request
   * @param req
   */
  readValue(req: Request): string | undefined {
    return this.#location === 'cookie' ? req.cookies.get(this.#name) : req.headerFirst(this.#name);
  }
}