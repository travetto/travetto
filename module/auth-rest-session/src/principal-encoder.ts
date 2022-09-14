import { Injectable, Inject } from '@travetto/di';
import { FilterContext } from '@travetto/rest';
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';
import { SessionService } from '@travetto/rest-session';

/**
 * Integration with the auth module, using the session as a backing
 * store for the auth principal.
 */
@Injectable()
export class SessionPrincipalEncoder implements PrincipalEncoder {
  #key = '_trv_auth_principal'; // Must be serializable, so it cannot be a symbol

  @Inject()
  service: SessionService;

  encode({ req }: FilterContext, p: Principal): void {
    if (p) {
      p.expiresAt = req.session.expiresAt; // Let principal live as long as the session
      req.session.setValue(this.#key, p);
    } else {
      req.session.destroy(); // Kill session
    }
  }

  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    await this.service.readRequest(req); // Preload session if not already loaded
    return req.session.getValue<Principal>(this.#key);
  }
}