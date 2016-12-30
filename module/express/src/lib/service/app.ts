import Config from '../config';

import * as express from 'express';
import { OnStartup } from '@encore/lifecycle';
import { Logger } from '@encore/logging';
import { Filter, FilterPromise, PathType, Method } from '../model';

export class AppService {
  private static app: express.Application;

  static use(...filters: Filter[]): void {
    AppService.app.use(...filters);
  }

  static errorHandler(handler: (err: any, req: express.Request, res: express.Response, next?: express.NextFunction) => void): void {
    AppService.app.use(handler);
  }

  static register(method: Method, pattern: PathType, filters: FilterPromise[], handler: FilterPromise) {
    let final = [...filters, handler];
    switch (method) {
      case 'get': AppService.app.get(pattern, ...final); break;
      case 'put': AppService.app.put(pattern, ...final); break;
      case 'post': AppService.app.post(pattern, ...final); break;
      case 'delete': AppService.app.delete(pattern, ...final); break;
      case 'patch': AppService.app.patch(pattern, ...final); break;
      case 'options': AppService.app.options(pattern, ...final); break;
    }
  }

  static init() {
    let app = AppService.app = express();
    let compression = require('compression');
    let cookieParser = require('cookie-parser');
    let bodyParser = require('body-parser');
    let session = require('express-session');

    app.use(compression());
    app.use(cookieParser());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
    app.use(session(Config.session)); // session secret

    // Enable proxy for cookies
    if (Config.session.cookie.secure) {
      app.enable('trust proxy');
    }
  }

  @OnStartup()
  static serve() {
    if (Config.serve && Config.port > 0) {
      Logger.info(`Listening on ${Config.port}`);
      AppService.app.listen(Config.port);
    }
  }
}