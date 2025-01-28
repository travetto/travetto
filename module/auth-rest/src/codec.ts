import { Principal } from '@travetto/auth';
import { RestCodecValue, FilterContext, RestCodecConfig } from '@travetto/rest';

import { PrincipalCodec } from './types';

export class DefaultPrincipalCodec implements PrincipalCodec {

  value: RestCodecValue<Principal>;

  constructor(cfg: RestCodecConfig) {
    this.reinit(cfg);
  }

  reinit(cfg: RestCodecConfig): void {
    this.value = new RestCodecValue<Principal>(cfg);
  }

  encode({ res }: FilterContext, p: Principal | undefined): void {
    this.value.writeValue(res, p, { expires: p?.expiresAt });
  }

  decode({ req }: FilterContext): Principal | undefined {
    return this.value.readValue(req);
  }
}
