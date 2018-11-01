import { RestInterceptor } from '@travetto/rest';
import { Injectable } from '@travetto/di';

@Injectable()
export class LoggingInterceptor extends RestInterceptor {
  async intercept(req: Travetto.Request, res: Travetto.Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
  }
}