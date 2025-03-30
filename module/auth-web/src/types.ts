import { AuthToken, Principal } from '@travetto/auth';
import { HttpRequest, HttpResponse } from '@travetto/web';

export const CommonPrincipalCodecSymbol = Symbol.for('@travetto/auth-web:common-codec');

/**
 * Web codec for reading/writing principal
 * @concrete
 */
export interface PrincipalCodec {
  /**
   * Extract token for re-use elsewhere
   */
  token?(req: HttpRequest): Promise<AuthToken | undefined> | AuthToken | undefined;
  /**
   * Encode data
   */
  encode(payload: HttpResponse, data: Principal | undefined): Promise<HttpResponse> | HttpResponse;
  /**
   * Decode data
   */
  decode(req: HttpRequest): Promise<Principal | undefined> | Principal | undefined;
}
