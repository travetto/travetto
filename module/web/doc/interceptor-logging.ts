import { HttpChainedContext, HttpInterceptor, HttpInterceptorCategory } from '@travetto/web';
import { Injectable } from '@travetto/di';

class Appender {
  write(...args: unknown[]): void { }
}

@Injectable()
export class CustomLoggingInterceptor implements HttpInterceptor {

  category: HttpInterceptorCategory = 'terminal';

  appender: Appender;

  constructor(appender: Appender) {
    this.appender = appender;
  }

  async filter({ req, next }: HttpChainedContext) {
    try {
      return await next();
    } finally {
      // Write request to database
      this.appender.write(req.method, req.path, req.query);
    }
  }
}