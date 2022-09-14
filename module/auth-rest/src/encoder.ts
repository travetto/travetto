import { Principal } from '@travetto/auth';
import { FilterContext } from '@travetto/rest';

/**
 * Encoder for auth context for request/response
 * @concrete ./internal/types:PrincipalEncoderTarget
 */
export interface PrincipalEncoder {
  /**
   * Write principal
   * @param ctx The travetto filter context
   * @param p The auth principal
   */
  encode(ctx: FilterContext, p: Principal | undefined): Promise<void> | void;
  /**
   * Read principal from request
   * @param ctx The travetto filter context
   */
  decode(ctx: FilterContext): Promise<Principal | undefined> | Principal | undefined;
}