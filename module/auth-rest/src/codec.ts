import { Principal } from '@travetto/auth';
import { FilterContext, Response, Request } from '@travetto/rest';
import { castTo, Util } from '@travetto/runtime';

import { PrincipalCodec } from './types';

type Config = { mode: 'cookie' | 'header', cookie: string, header: string, headerPrefix?: string };

const toDate = (v: string | Date | undefined): Date | undefined => (typeof v === 'string') ? new Date(v) : v;

export class CommonPrincipalCodec<P = Principal> implements PrincipalCodec {

  #config: Config;

  constructor(config: Partial<Config> = {}) {
    this.#config = {
      header: 'Authorization',
      headerPrefix: 'Token',
      cookie: 'trv_auth',
      mode: 'cookie',
      ...config
    };
  }

  init(config: Partial<Config>): void {
    this.#config.cookie = config.cookie ?? this.#config.cookie;
    this.#config.header = config.header ?? this.#config.header;
    this.#config.headerPrefix = config.headerPrefix ?? this.#config.headerPrefix;
    this.#config.mode = config.mode ?? this.#config.mode;
  }

  toPayload?(p: Principal | undefined): Promise<P | undefined> | P | undefined;
  fromPayload?(p: P): Promise<Principal | undefined> | Principal | undefined;

  writeValue(res: Response, output: string | undefined, expires?: Date): void {
    if (this.#config.mode === 'cookie') {
      res.cookies.set(this.#config.cookie, output, {
        expires,
        maxAge: (expires && output !== undefined) ? undefined : -1,
      });
    }
    if (output && this.#config.mode === 'header') {
      res.setHeader(this.#config.header, this.#config.headerPrefix ? `${this.#config.headerPrefix} ${output}` : output);
    }
  }

  readValue(req: Request): string | undefined {
    return (this.#config.mode === 'cookie') ?
      req.cookies.get(this.#config.cookie) :
      req.headerFirst(this.#config.header, this.#config.headerPrefix);
  }

  async encode({ res }: FilterContext, principal: Principal | undefined): Promise<void> {
    const payload = this.toPayload ? await this.toPayload(principal) : principal;
    this.writeValue(res, Util.encodeSafeJSON(payload), principal?.expiresAt);
  }

  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const payload = Util.decodeSafeJSON<P>(this.readValue(req))!;
    let principal: Principal | undefined;
    if (payload) {
      principal = this.fromPayload ? await this.fromPayload(payload) : castTo(payload);
      if (principal) {
        principal.expiresAt = toDate(principal.expiresAt);
        principal.issuedAt = toDate(principal.issuedAt);
      }
    }
    return principal;
  }
}