import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext, EndpointConfig, HttpResponse } from '@travetto/web';
import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { AuthService } from '@travetto/auth';

import { AuthContextInterceptor } from './context.ts';

@Config('web.auth.login')
export class WebAuthLoginConfig {
  /**
   * Execute login on endpoint
   */
  applies = false;
  /**
   * The auth providers to iterate through when attempting to authenticate
   */
  @Ignore()
  providers: symbol[];
}

/**
 * Login interceptor
 *
 * - Supports the ability to encode context via request/response.
 * - Connects the principal to the request
 */
@Injectable()
export class AuthLoginInterceptor implements HttpInterceptor<WebAuthLoginConfig> {

  category: HttpInterceptorCategory = 'application';
  dependsOn = [AuthContextInterceptor];

  @Inject()
  config: WebAuthLoginConfig;

  @Inject()
  service: AuthService;

  applies(ep: EndpointConfig, config: WebAuthLoginConfig): boolean {
    return config.applies;
  }

  async filter(ctx: HttpChainedContext<WebAuthLoginConfig>): Promise<HttpResponse> {
    await this.service.authenticate(ctx.req.body, ctx, ctx.config.providers ?? []);
    return ctx.next();
  }
}