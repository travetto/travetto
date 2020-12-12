import { Injectable } from '@travetto/di';
import { Request, Response } from '../../../src/types';
import { RestInterceptor } from '../../../src/interceptor/interceptor';

class Appender {
  write(...args: any[]): void { }
}

@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  constructor(private appender: Appender) {
    super();
  }

  async intercept(req: Request, res: Response) {
    // Write request to database
    this.appender.write(req.method, req.path, req.query);
  }
}