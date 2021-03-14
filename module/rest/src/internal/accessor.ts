import { SetOption } from 'cookies';
import { Response, Request } from '../types';

/**
 * Utils for context encoding
 */
export class ValueAccessor {
  constructor(private name: string, private location: 'header' | 'cookie') { }

  /**
   * Write to Response
   * @param res
   * @param token
   */
  writeValue(res: Response, token: string | null, cookieArgs: SetOption = {}) {
    if (this.location === 'cookie') {
      res.cookies.set(this.name, token, {
        ...cookieArgs,
        maxAge: cookieArgs.expires ? undefined : -1,
      });
    } else if (token) {
      res.setHeader(this.name, token);
    }
  }

  /**
   * Read form request
   * @param req
   */
  readValue(req: Request) {
    return this.location === 'cookie' ? req.cookies.get(this.name) : req.header(this.name) as string;
  }
}