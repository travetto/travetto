import type { AuthToken, Principal } from '@travetto/auth';
import type { WebRequest, WebResponse } from '@travetto/web';

export const CommonPrincipalCodecSymbol = Symbol.for('@travetto/auth-web:common-codec');

/**
 * Web codec for reading/writing principal
 * @concrete
 */
export interface PrincipalCodec {
  /**
   * Extract token for re-use elsewhere
   */
  token?(request: WebRequest): Promise<AuthToken | undefined> | AuthToken | undefined;
  /**
   * Encode data
   */
  encode(payload: WebResponse, data: Principal | undefined): Promise<WebResponse> | WebResponse;
  /**
   * Decode data
   */
  decode(request: WebRequest): Promise<Principal | undefined> | Principal | undefined;
}
