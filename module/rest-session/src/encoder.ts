import { Injectable } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';

/**
 * Integration with the auth module,  using the session as a backing
 * store for the auth principal.
 */
@Injectable()
export class SessionPrincipalEncoder implements PrincipalEncoder {

  key = '_trv_auth_principal'; // Must be serializable, so it cannot be a symbol

  /**
   * Persist the auth context to the session
   */
  async encode(req: Request, res: Response, p: Principal) {
    if (p) {
      req.session.expiresAt = p.expiresAt; // TODO: Validate
      req.session.setValue(this.key, p);
    } else {
      req.session.destroy(); // Kill session
    }
  }

  /**
   * Build an auth context on top of the session
   */
  async decode(req: Request) {
    return req.session.getValue<Principal>(this.key);
  }
}