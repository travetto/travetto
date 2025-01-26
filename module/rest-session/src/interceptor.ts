import { Class, RuntimeIndex } from '@travetto/runtime';
import { Injectable, Inject } from '@travetto/di';
import { CookiesInterceptor, RestInterceptor, FilterContext, FilterNext, SerializeInterceptor, AsyncContextInterceptor } from '@travetto/rest';

import { SessionService } from './service';
import { SessionCodec } from './codec';
import { RestSessionConfig } from './config';

/**
 * Loads session, and provides ability to create session as needed, persists when complete.
 */
@Injectable()
export class SessionInterceptor implements RestInterceptor {

  dependsOn: Class<RestInterceptor>[] = [CookiesInterceptor, SerializeInterceptor, AsyncContextInterceptor];
  runsBefore: Class<RestInterceptor>[] = [];

  @Inject()
  service: SessionService;

  @Inject()
  config: RestSessionConfig;

  @Inject()
  codec: SessionCodec;

  async postConstruct(): Promise<void> {
    if (RuntimeIndex.hasModule('@travetto/auth-rest')) {
      const { AuthReadWriteInterceptor } = await import('@travetto/auth-rest');
      this.runsBefore.push(AuthReadWriteInterceptor);
    }
  }

  async intercept(ctx: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      await this.service.load(() => this.codec.decode(ctx));
      Object.defineProperty(ctx.req, 'session', { get: () => this.service.getOrCreate() });
      return await next();
    } finally {
      await this.service.persist(value => this.codec.encode(ctx, value?.id));
    }
  }
}