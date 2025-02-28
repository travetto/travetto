import { WebInterceptor, FilterContext, FilterNext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class LoggingInterceptor implements WebInterceptor {
  async intercept(ctx: FilterContext, next: FilterNext) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}