import { Principal } from '@travetto/auth';
import { Injectable } from '@travetto/di';
import { RestCodecValue, FilterContext } from '@travetto/rest';

import { PrincipalCodec } from './types';

@Injectable()
export class DefaultPrincipalCodec implements PrincipalCodec {

  value = new RestCodecValue<Principal>({ cookie: 'default_auth' });

  encode({ res }: FilterContext, p: Principal | undefined): void {
    this.value.writeValue(res, p);
  }

  decode({ req }: FilterContext): Principal | undefined {
    return this.value.readValue(req);
  }
}
