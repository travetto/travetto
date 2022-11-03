import { FilterContext, RestInterceptor } from '@travetto/rest';
import { Injectable } from '@travetto/di';

class Appender {
  write(...args: unknown[]): void { }
}

@Injectable()
export class LoggingInterceptor implements RestInterceptor {

  constructor(private appender: Appender) { }

  async intercept({ req }: FilterContext) {
    // Write request to database
    this.appender.write(req.method, req.path, req.query);
  }
}