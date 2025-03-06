import { Injectable, Inject } from '@travetto/di';
import { AsyncContext, AsyncContextValue } from '@travetto/context';
import { AuthContext, AuthenticationError } from '@travetto/auth';

import { Session } from './session';

/**
 * Session context, injectable wherever needed
 */
@Injectable()
export class SessionContext {

  @Inject()
  context: AsyncContext;

  @Inject()
  authContext: AuthContext;

  #value = new AsyncContextValue<Session>(this, { failIfUnbound: { write: true } });

  #create(): Session {
    const principal = this.authContext.principal;
    if (!principal) {
      throw new AuthenticationError('Unable to establish session without first authenticating');
    }
    return new Session({
      id: principal.sessionId,
      expiresAt: principal.expiresAt,
      issuedAt: principal.issuedAt,
      action: 'create',
      data: {},
    });
  }

  /**
   * Get session if defined
   */
  get(createIfMissing: true): Session;
  get(): Session | undefined;
  get(createIfMissing?: boolean): Session | undefined {
    let val = this.#value.get();
    if (!val && createIfMissing) {
      this.set(val = this.#create());
    }
    return val;
  }

  /**
   * Set the session state directly
   */
  set(session: Session | undefined): void {
    this.#value.set(session);
  }

  /**
   * Destroy
   */
  destroy(): void {
    this.get()?.destroy();
    this.set(undefined);
  }
}