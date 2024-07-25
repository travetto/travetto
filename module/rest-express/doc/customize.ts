import { TimeUtil } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { ExpressRestServer } from '@travetto/rest-express';

declare let rateLimit: (config: { windowMs: number, max: number }) => ((req: Express.Request, res: Express.Response) => void);

@Injectable({ primary: true })
class CustomRestServer extends ExpressRestServer {
  override async init() {
    const app = await super.init();
    const limiter = rateLimit({
      windowMs: TimeUtil.asMillis(15, 'm'), // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });

    //  apply to all requests
    app.use(limiter);

    return app;
  }
}