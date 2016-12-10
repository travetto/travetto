import * as express from 'express';
import Config from './config';
import { Ready } from '@encore/init';
import { requestContext } from '@encore/context/ext/express';
import { Logger } from '@encore/logging';

let compression = require('compression');
let cookieParser = require('cookie-parser');
let bodyParser = require('body-parser');
let session = require('express-session');

export const app: express.Application = express();
app.use((req, res, next) => {
  Logger.info(`[${req.method}] ${req.path}`, req.params, req.query);
  next();
});
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(bodyParser.raw({ type: 'image/*' }));
app.use(session(Config.session)); // session secret

app.use(requestContext);

// Enable proxy for cookies
if (Config.session.cookie.secure) {
  app.enable('trust proxy');
}

Ready.onReady(() => {
  if (Config.serve && Config.port > 0) {
    console.log(`Listening on ${Config.port}`);
    app.listen(Config.port)
  }
});