import { Injectable } from '@travetto/di';
import { Interceptor } from '@travetto/web';

@Injectable()
export class RequestLoggingInterceptor implements Interceptor {
  async intercept<T>(next: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await next();
    } finally {
      const duration = Date.now() - start;
      console.log('request-duration-ms', duration);
    }
  }
}
