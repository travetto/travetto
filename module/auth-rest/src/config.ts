import { Config } from '@travetto/config';
import { Util } from '@travetto/runtime';
import { Request, Response } from '@travetto/rest';

@Config('rest.auth')
export class RestAuthConfig {
  mode?: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';

  writeValue<T = unknown>(res: Response, value: T | undefined, expires?: Date): void {
    const output = Util.encodeSafeJSON<T>(value);

    if (this.mode === 'cookie') {
      res.cookies.set(this.cookie, output, {
        expires,
        maxAge: (expires && output !== undefined) ? undefined : -1,
      });
    }
    if (output && this.mode === 'header') {
      res.setHeader(this.header, this.headerPrefix ? `${this.headerPrefix} ${output}` : output);
    }
  }

  readValue<T = unknown>(req: Request): T | undefined {
    const res = (this.mode === 'cookie') ?
      req.cookies.get(this.cookie) :
      req.headerFirst(this.header, this.headerPrefix);

    return Util.decodeSafeJSON<T>(res)!;
  }
}