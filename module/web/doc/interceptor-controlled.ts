import { HttpInterceptor, HttpContext, WebFilterNext } from '@travetto/web';
import { Injectable } from '@travetto/di';

@Injectable()
export class SimpleLoggingInterceptor implements HttpInterceptor {
  async intercept(ctx: HttpContext, next: WebFilterNext) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}