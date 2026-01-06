import { Injectable, Inject } from '@travetto/di';
import { type AsyncContext, AsyncContextValue } from '@travetto/context';
import { type AuthContext, AuthenticationError } from '@travetto/auth';

import { Session } from './session.ts';

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
    let value = this.#value.get();
    if (!value && createIfMissing) {
      this.set(value = this.#create());
    }
    return value;
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