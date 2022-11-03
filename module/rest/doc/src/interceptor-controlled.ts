import { RestInterceptor, FilterContext, FilterNext } from '@travetto/rest';
import { Injectable } from '@travetto/di';

@Injectable()
export class LoggingInterceptor implements RestInterceptor {
  async intercept(ctx: FilterContext, next: FilterNext) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}