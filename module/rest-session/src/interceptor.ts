import { Injectable } from '@travetto/di';
import { RestInterceptor, Request, Response } from '@travetto/rest';

@Injectable()
export class SessionInterceptor extends RestInterceptor {
  async intercept(req: Request, res: Response, next: () => Promise<any>) {
    const result = await next();
    return result;
  }
}