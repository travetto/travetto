import { Class } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { RestInterceptor, FilterContext, FilterNext, ManagedInterceptorConfig, ParamExtractor } from '@travetto/rest';
import { SessionService } from '@travetto/auth-session';
import { SessionDataTarget } from '@travetto/auth-session/src/internal/types';
import { Config } from '@travetto/config';
import { AuthReadWriteInterceptor } from '@travetto/auth-rest';

@Config('rest.session')
class RestSessionConfig implements ManagedInterceptorConfig { }

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class AuthSessionInterceptor implements RestInterceptor {

  dependsOn: Class<RestInterceptor>[] = [AuthReadWriteInterceptor];
  runsBefore: Class<RestInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  async intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      await this.service.load();
      Object.defineProperty(ctx.req, 'session', { get: () => this.service.getOrCreate() });
      return await next();
    } finally {
      await this.service.persist();
    }
  }
}

ParamExtractor.registerContext(SessionDataTarget, (_, req) => req.session?.data);