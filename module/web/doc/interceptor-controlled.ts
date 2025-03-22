import { HttpInterceptor, HttpContext, HttpInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleLoggingInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';

  async intercept(ctx: HttpContext) {
    const start = Date.now();
    try {
      return await ctx.next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}