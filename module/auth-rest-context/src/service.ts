import { Principal } from '@travetto/auth';
import { AsyncContext } from '@travetto/context';
import { Inject, Injectable } from '@travetto/di';

const PrincipalⲐ = Symbol.for('@trv:auth/principal');

/**
 * Provides global context to accessing principal
 */
@Injectable()
export class AuthContextService {

  @Inject()
  context: AsyncContext;

  /**
   * Set principal
   * @param p The auth principal
   */
  set = (p: Principal | undefined): void => this.context.set(PrincipalⲐ, p);

  /**
   * Get the principal from the context
   * @returns principal if authenticated
   * @returns undefined if not authenticated
   */
  get = (): (Principal | undefined) => this.context.get<Principal>(PrincipalⲐ);
}