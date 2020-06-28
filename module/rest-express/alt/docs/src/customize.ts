import { Injectable } from '@travetto/di';
import { ExpressRestServer } from '../../..';

declare let rateLimit: any;

@Injectable({ primary: true })
class CustomRestServer extends ExpressRestServer {
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