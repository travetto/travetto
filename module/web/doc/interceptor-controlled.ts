import { HttpInterceptor, HttpContext, HttpFilterNext, HttpInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleLoggingInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';

  async intercept(ctx: HttpContext, next: HttpFilterNext) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}