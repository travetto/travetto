import { ExpressConfig } from '../config';

import * as express from 'express';
import { Logger } from '@encore/log';
import { Filter, FilterPromise, PathType, Method, ControllerConfig } from '../model';
import { Injectable } from '@encore/di';
import { RouteRegistry } from './route';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

@Injectable({ autoCreate: { create: true, priority: 1 } })
export class AppService {
  private app: express.Application;
  private controllers = new Map<string, ControllerConfig>();

  constructor(private config: ExpressConfig) {
  }

  postConstruct() {
    this.app = express();
    this.app.use(compression());
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded());
    this.app.use(bodyParser.raw({ type: 'image/*' }));
    this.app.use(session(this.config.session)); // session secret

    //    import { requestContext } from '@encore/context/ext/express';
    //    .use(requestContext)

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      this.app.enable('trust proxy');
    }

    // Register all active
    for (let config of RouteRegistry.controllers.values()) {
      this.registerController(config);
    }

    // Listen for updates
    RouteRegistry.events.on('reload', this.registerController.bind(this));

    this.app.use(RouteRegistry.errorHandler);

    if (this.config.serve && this.config.port > 0) {
      console.log(`Listening on ${this.config.port}`);
      this.app.listen(this.config.port);
    }
  }

  unregisterController(config: ControllerConfig) {
    // Un-register
    let controllerRoutes = new Map<PathType, Set<Method>>();
    for (let { method, path } of this.controllers.get(config.path)!.handlers) {
      if (!controllerRoutes.has(path!)) {
        controllerRoutes.set(path!, new Set());
      }
      controllerRoutes.get(path!)!.add(method!);
    }

    let stack = this.app._router.stack;

    console.log('Keys', Array.from(controllerRoutes.keys()));
    console.log('Values', Array.from(controllerRoutes.values()));

    stack.forEach(removeMiddlewares);
    function removeMiddlewares(route: any, i: number, stackRoutes: any[]) {
      if (route.route) {
        route.route.stack.forEach(removeMiddlewares);
      }
      if (route.path) {
        console.log('Looking at', route.path);
      }
      if (route.path && controllerRoutes.has(route.path)) {
        let methods = controllerRoutes.get(route.path)!;
        let method = route.methods && Object.keys(route.methods)[0] as any;
        console.log('Comparing', methods, route.methods, route.path);
        if (methods.has(method)) {
          console.log(`Dropping ${method}/${route.path}`);
          stackRoutes.splice(i, 1);
        }
      }
    }
  }

  registerController(config: ControllerConfig) {
    if (this.controllers.has(config.path)) {
      console.log('Unregistering', config.path);
      this.unregisterController(config);
    }
    console.log('Registering', config.path, config.handlers.length);
    for (let { method, path, filters, handler } of config.handlers) {
      this.register(method!, path!, filters!, handler);
    }
    this.controllers.set(config.path, config);
  }

  get() {
    return this.app;
  }

  private register(method: Method, pattern: PathType, filters: FilterPromise[], handler: FilterPromise) {
    let final = [...filters, handler];
    switch (method) {
      case 'get': this.app.get(pattern, ...final); break;
      case 'put': this.app.put(pattern, ...final); break;
      case 'post': this.app.post(pattern, ...final); break;
      case 'delete': this.app.delete(pattern, ...final); break;
      case 'patch': this.app.patch(pattern, ...final); break;
      case 'options': this.app.options(pattern, ...final); break;
    }
  }
}