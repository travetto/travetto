import { Principal } from '@travetto/auth';
import { FilterContext, Response, Request } from '@travetto/rest';
import { castTo, Util } from '@travetto/runtime';

import { PrincipalCodec } from './types';

type Cookie = { cookie: string };
type Header = { header: string, headerPrefix?: string };

export class DefaultPrincipalCodec implements PrincipalCodec {

  config: Cookie & Header;

  constructor(config: Cookie | Header) {
    this.config = castTo(config);
  }

  writeValue(res: Response, output: string | undefined, expires?: Date): void {
    if (this.config.cookie) {
      res.cookies.set(this.config.cookie, output, {
        expires,
        maxAge: (expires && output !== undefined) ? undefined : -1,
      });
    }
    if (output && this.config.header) {
      res.setHeader(this.config.header, this.config.headerPrefix ? `${this.config.headerPrefix} ${output}` : output);
    }
  }

  readValue(req: Request): string | undefined {
    return (this.config.cookie ? req.cookies.get(this.config.cookie) : undefined) ??
      (this.config.header ? req.headerFirst(this.config.header, this.config.headerPrefix) : undefined);
  }

  async encode({ res }: FilterContext, p: Principal | undefined): Promise<void> {
    this.writeValue(res, Util.encodeSafeJSON(p), p?.expiresAt);
  }

  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    return Util.decodeSafeJSON(this.readValue(req));
  }
}
