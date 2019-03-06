import { RestInterceptor, Request, Response } from '@travetto/rest';
import { Injectable } from '@travetto/di';

@Injectable()
export class CorsInterceptor extends RestInterceptor {
  async intercept(req: Request, res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }
}