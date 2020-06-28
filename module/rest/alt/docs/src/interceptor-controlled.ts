import { Injectable } from '@travetto/di';
import { RestInterceptor } from '../../../src/interceptor/interceptor';
import { Response, Request } from '../../../src/types';

@Injectable()
export class LoggingInterceptor extends RestInterceptor {
  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const start = Date.now();
    try {
      await next();
    } finally {
      console.log(`Request took ${Date.now() - start}ms`);
    }
  }
}