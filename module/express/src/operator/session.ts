import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';

import { Injectable, Inject } from '@travetto/di';
import { Config } from '@travetto/config';

import { ExpressOperator } from '../types';
import { BodyOperator } from './body';
import { CompressionOperator } from './compression';

@Config('express.session')
export class ExpressSessionConfig {
  secret = 'random key';
  cookie = {
    secure: false,
    secureProxy: false
  };
}

@Injectable()
export class SessionOperator extends ExpressOperator {

  @Inject()
  private config: ExpressSessionConfig;

  after = [BodyOperator, CompressionOperator];

  operate(app: express.Application): void {
    app.use(cookieParser());
    app.use(session(this.config)); // session secret

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      app.enable('trust proxy');
    }
  }
}
