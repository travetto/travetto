
import * as session from 'express-session';

import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ExpressOperator } from '../service/operator';
import { ExpressApp } from '../service/app';

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

  constructor(private config: ExpressSessionConfig) {
    super();
    this.priority = 20;
  }

  operate(app: ExpressApp): void {
    app.get().use(session(this.config)); // session secret

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      app.get().enable('trust proxy');
    }
  }
}
