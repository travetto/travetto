import { AuthToken, Principal } from '@travetto/auth';
import { FilterContext } from '@travetto/rest';

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