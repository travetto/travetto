import { Request, Response, RestInterceptor } from '@travetto/rest';
import { Injectable } from '@travetto/di';

class Appender {
  write(...args: any[]): void { }
}

@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  constructor(private appender: Appender) { }

  async intercept(req: Request, res: Response) {
    // Write request to database
    this.appender.write(req.method, req.path, req.query);
  }
}