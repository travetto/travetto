import { Principal } from '@travetto/auth';
import { FilterContext } from '@travetto/rest';

export const CommonPrincipalCodecSymbol = Symbol.for('@travetto/auth-rest:common-codec');

/**
 * Rest codec for reading/writing principal
 * @concrete ./internal/types#PrincipalCodecTarget
 */
export interface PrincipalCodec {
  /**
   * Encode data
   */
  encode(ctx: FilterContext, data: Principal | undefined): Promise<void> | void;
  /**
   * Decode data
   */
  decode(ctx: FilterContext): Promise<Principal | undefined> | Principal | undefined;
}