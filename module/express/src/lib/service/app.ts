import Config from '../config';

import * as express from 'express';
import { OnStartup } from '@encore/lifecycle';
import { Logger } from '@encore/logging';
import { Filter, FilterPromise, PathType, Method } from '../model';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

export class AppService {
  private static app: express.Application;

  static get() {
    return AppService.app;
  }

  static use(...filters: Filter[]) {
    AppService.app.use(...filters);
    return AppService;
  }

  static enable(features: string) {
    AppService.app.enable(features);
    return AppService;
  }

  static disable(features: string) {
    AppService.app.disable(features);
    return AppService;
  }

  static enabled(features: string) {
    return AppService.app.enabled(features);
  }

  static disabled(features: string) {
    return AppService.app.disabled(features);
  }

  static errorHandler(handler: (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => void) {
    AppService.app.use(handler);
    return AppService;
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
    if (!AppService.app) {
      AppService.app = express();
      AppService.use(compression());
      AppService.use(cookieParser());
      AppService.use(bodyParser.json());
      AppService.use(bodyParser.urlencoded());
      AppService.use(bodyParser.raw({ type: 'image/*' }));
      AppService.use(session(Config.session)); // session secret

      // Enable proxy for cookies
      if (Config.session.cookie.secure) {
        AppService.enable('trust proxy');
      }
    }
    return AppService;
  }

  @OnStartup()
  static serve() {
    if (Config.serve && Config.port > 0) {
      Logger.info(`Listening on ${Config.port}`);
      AppService.app.listen(Config.port);
    }
  }
}