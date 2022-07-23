// @file-if @travetto/auth-rest
import { Inject, Injectable } from '@travetto/di';
import { Request, Response } from '@travetto/rest';
import { Principal } from '@travetto/auth';
import { PrincipalEncoder } from '@travetto/auth-rest';

import { SessionService } from '../service';

/**
 * Integration with the auth module, using the session as a backing
 * store for the auth principal.
 */
@Injectable()
export class SessionPrincipalEncoder implements PrincipalEncoder {
  #key = '_trv_auth_principal'; // Must be serializable, so it cannot be a symbol

  @Inject()
  service: SessionService;

  encode(req: Request, res: Response, p: Principal): void {
    if (p) {
      p.expiresAt = req.session.expiresAt; // Let principal live as long as the session
      req.session.setValue(this.#key, p);
    } else {
      req.session.destroy(); // Kill session
    }
  }

  async decode(req: Request): Promise<Principal | undefined> {
    await this.service.readRequest(req); // Preload session if not already loaded
    return req.session.getValue<Principal>(this.#key);
  }
}