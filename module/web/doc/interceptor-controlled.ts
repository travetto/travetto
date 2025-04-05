import { WebInterceptor, WebInterceptorCategory, WebChainedContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleLoggingInterceptor implements WebInterceptor {

  category: WebInterceptorCategory = 'terminal';

  async filter(ctx: WebChainedContext) {
    const start = Date.now();
    try {
      return await ctx.next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}