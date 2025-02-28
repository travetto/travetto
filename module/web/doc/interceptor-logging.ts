import { FilterContext, WebInterceptor } from '@travetto/web';
import { Injectable } from '@travetto/di';

class Appender {
  write(...args: unknown[]): void { }
}

@Injectable()
export class LoggingInterceptor implements WebInterceptor {

  appender: Appender;

  constructor(appender: Appender) {
    this.appender = appender;
  }

  async intercept({ req }: FilterContext) {
    // Write request to database
    this.appender.write(req.method, req.path, req.query);
  }
}