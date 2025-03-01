import { AuthToken, Principal } from '@travetto/auth';
import { FilterContext } from '@travetto/web';

export const CommonPrincipalCodecSymbol = Symbol.for('@travetto/auth-web:common-codec');

/**
 * Web codec for reading/writing principal
 * @concrete
 */
export interface PrincipalCodec {
  /**
   * Extract token for re-use elsewhere
   */
  token?(ctx: FilterContext): Promise<AuthToken | undefined> | AuthToken | undefined;
  /**
   * Encode data
   */
  encode(ctx: FilterContext, data: Principal | undefined): Promise<void> | void;
  /**
   * Decode data
   */
  decode(ctx: FilterContext): Promise<Principal | undefined> | Principal | undefined;
}
