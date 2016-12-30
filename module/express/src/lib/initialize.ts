import * as express from 'express';
import Config from './config';
import { OnStartup } from '@encore/lifecycle';
import { requestContext } from '@encore/context/ext/express';
import { Logger } from '@encore/logging';
import { RouteRegistry } from './service';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

export const app: express.Application = express();
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.raw({ type: 'image/*' }));
app.use(session(Config.session)); // session secret

app.use(requestContext);
app.use(RouteRegistry.errorHandler);

// Enable proxy for cookies
if (Config.session.cookie.secure) {
  app.enable('trust proxy');
}

export class Init {
  @OnStartup()
  static serve() {
    if (Config.serve && Config.port > 0) {
      Logger.info(`Listening on ${Config.port}`);
      app.listen(Config.port);
    }
  }
}