import { Injectable } from '@travetto/di';
import { type WebChainedContext, WebError, type WebInterceptor, type WebInterceptorCategory } from '@travetto/web';

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
