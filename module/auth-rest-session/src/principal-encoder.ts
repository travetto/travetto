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

  encode(_: FilterContext, p: Principal): void {
    const session = this.service.get();
    if (p) {
      p.expiresAt = session.expiresAt; // Let principal live as long as the session
      session.setValue(this.#key, p);
    } else {
      session.destroy(); // Kill session
    }
  }

  async decode({ req }: FilterContext): Promise<Principal | undefined> {
    const session = await this.service.get(); // Preload session if not already loaded
    return session?.getValue<Principal>(this.#key);
  }
}