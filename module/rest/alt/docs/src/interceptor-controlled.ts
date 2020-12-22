import { Injectable } from '@travetto/di';
import { RestInterceptor } from '../../../src/interceptor/types';
import { Response, Request } from '../../../src/types';

@Injectable()
export class LoggingInterceptor implements RestInterceptor {
  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log('Request complete', { time: Date.now() - start });
    }
  }
}