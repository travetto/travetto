import { WebInterceptor, WebInterceptorCategory, WebChainedContext, WebResponse } from '@travetto/web';
import { Injectable } from '@travetto/di';
import { AppError } from '@travetto/runtime';

@Injectable()
export class SimpleAuthInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';

  async filter(ctx: WebChainedContext) {
    if (ctx.request.headers.has('X-Auth')) {
      return await ctx.next();
    } else {
      // Or just -- throw new AppError('Missing auth', { category: 'authentication' });
      return new WebResponse({
        body: new AppError('Missing auth', { category: 'authentication' }),
        context: {
          httpStatusCode: 401
        }
      });
    }
  }
}