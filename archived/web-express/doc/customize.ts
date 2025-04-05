import { TimeUtil } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { ExpressWebServer } from '@travetto/web-express';

declare let rateLimit: (config: { windowMs: number, max: number }) => ((req: Express.Request, res: Express.Response) => void);

@Injectable({ primary: true })
class CustomWebServer extends ExpressWebServer {
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