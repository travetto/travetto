import { Injectable, Inject } from '@travetto/di';
import { CookiesInterceptor, RestInterceptor, Request, Response } from '@travetto/rest';
import { AuthInterceptor } from '@travetto/auth-rest';
import { ValueAccessor } from '@travetto/rest/src/internal/accessor';

import { SessionService } from './service';
import { SessionSym } from './internal/types';
import { Session } from './session';
import { SessionConfig } from './config';

/**
 * Tracks the user activity and loads/stores the session for a given
 * request/response depending on session existence and state change
 */
@Injectable()
export class SessionInterceptor implements RestInterceptor {

  after = [CookiesInterceptor];
  before = [AuthInterceptor];
  #accessor: ValueAccessor;

  @Inject()
  service: SessionService;

  @Inject()
  config: SessionConfig;

  postConstruct() {
    this.#accessor = new ValueAccessor(this.config.keyName, this.config.transport);
  }

  /**
   * Configure request and provide controlled access to the raw session
   */
  #configure(req: Request) {
    Object.defineProperties(req, {
      session: {
        get(this: Request) {
          if (!(SessionSym in this) || this[SessionSym].action === 'destroy') {
            this[SessionSym] = new Session({ action: 'create', data: {} });
          }
          return this[SessionSym];
        },
        enumerable: true,
        configurable: false
      }
    });
  }

  async intercept(req: Request, res: Response, next: () => Promise<unknown>) {
    try {
      this.#configure(req);

      const id = this.#accessor.readValue(req);
      if (id) {
        req[SessionSym] = (await this.service.load(id))!;
      }
      return await next();
    } finally {
      const value = await this.service.store(req[SessionSym]);
      if (value === null) {
        // Send updated info only if expiry changed
        this.#accessor.writeValue(res, null, { expires: new Date() });
      } else if (value?.isTimeChanged()) {
        this.#accessor.writeValue(res, value.id, { expires: value.expiresAt });
      }
    }
  }
}