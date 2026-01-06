import { type WebInterceptor, type WebInterceptorCategory, type WebChainedContext, WebError } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleAuthInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';

  async filter(ctx: WebChainedContext) {
    if (ctx.request.headers.has('X-Auth')) {
      return await ctx.next();
    } else {
      throw WebError.for('Missing auth', 401, {}, 'authentication');
    }
  }
}