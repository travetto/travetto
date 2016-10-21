import * as express from "express";
import Config from './config';
import { canAccept } from './util';
import { Ready } from '../init';
import * as http from 'http';
import { Storage, Context } from './service';

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

app.use((req, res, next) => {
  Storage.bindEmitter(req);
  Storage.bindEmitter(res);
  Storage.run(() => {
    Context.set({ req, res });
    if (next) next()
  });
});

//Enable proxy for cookies
if (Config.session.cookie.secure) {
  app.enable('trust proxy');
}

if (Config.serve) {
  Ready.onReady(() => {
    if (Config.port > 0) {
      console.log(`Listening on ${Config.port}`);
      app.listen(Config.port)
    }
  })
}