import { Request, Response, RestInterceptor } from '@travetto/rest';
import { Injectable } from '@travetto/di';

class Appender {
  write(...args: unknown[]): void { }
}

@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  #appender: Appender;

  constructor(appender: Appender) {
    this.#appender = appender;
  }

  async intercept(req: Request, res: Response) {
    // Write request to database
    this.#appender.write(req.method, req.path, req.query);
  }
}