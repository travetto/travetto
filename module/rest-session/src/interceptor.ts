import { Class, RuntimeIndex } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Injectable, Inject } from '@travetto/di';
import {
  CookiesInterceptor, RestInterceptor, ManagedInterceptorConfig, FilterContext, FilterNext,
  SerializeInterceptor, AsyncContextInterceptor, Request, Response
} from '@travetto/rest';

import { SessionService } from './service';
import { Session } from './session';

@Config('rest.session')
export class RestSessionConfig extends ManagedInterceptorConfig {
  /**
   * Auth output key name
   */
  keyName = 'trv_sid';
  /**
   * Location for auth
   */
  transport: 'cookie' | 'header' = 'cookie';
}

@Injectable()
class SessionEncoder {

  @Inject()
  config: RestSessionConfig;

  read(req: Request): Promise<string | undefined> | string | undefined {
    return this.config.transport === 'cookie' ?
      req.cookies.get(this.config.keyName) :
      req.headerFirst(this.config.keyName);
  }

  async write(res: Response, value: Session | null | undefined): Promise<void> {
    if (this.config.transport === 'cookie' && value !== undefined) {
      res.cookies.set(this.config.keyName, value?.id ?? null, {
        expires: value?.expiresAt ?? new Date(),
        maxAge: undefined
      });
    } else if (this.config.transport === 'header' && value?.action === 'create') {
      res.setHeader(this.config.keyName, value.id);
    }
  }
}

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
  encoder: SessionEncoder;

  async postConstruct(): Promise<void> {
    if (RuntimeIndex.hasModule('@travetto/auth-rest')) {
      const { AuthReadWriteInterceptor } = await import('@travetto/auth-rest');
      this.runsBefore.push(AuthReadWriteInterceptor);
    }
  }

  async intercept({ req, res }: FilterContext, next: FilterNext): Promise<unknown> {
    try {
      await this.service.load(() => this.encoder.read(req));
      Object.defineProperty(req, 'session', { get: () => this.service.getOrCreate() });
      return await next();
    } finally {
      await this.service.persist(value => this.encoder.write(res, value));
    }
  }
}