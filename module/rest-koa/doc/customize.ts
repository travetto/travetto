import { Injectable } from '@travetto/di';
import { KoaRestServer } from '@travetto/rest-koa';

declare let rateLimit: any;

@Injectable({ primary: true })
class CustomRestServer extends KoaRestServer {
  createRaw() {
    const app = super.createRaw();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.use(limiter);

    return app;
  }
}