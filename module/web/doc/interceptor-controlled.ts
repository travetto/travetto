import { HttpInterceptor, HttpInterceptorCategory, HttpChainedContext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleLoggingInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';

  async filter(ctx: HttpChainedContext) {
    const start = Date.now();
    try {
      return await ctx.next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}