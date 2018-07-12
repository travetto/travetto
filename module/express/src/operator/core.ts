import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';

import { Injectable } from '@travetto/di';

import { ExpressOperator } from '../service/operator';
import { ExpressApp } from '../service/app';

@Injectable()
export class CoreOperator extends ExpressOperator {

  constructor() {
    super();

    this.priority = 10;
  }

  operate(app: ExpressApp): void {
    app.get().use(compression());
    app.get().use(cookieParser());
    app.get().use(bodyParser.json());
    app.get().use(bodyParser.urlencoded());
    app.get().use(bodyParser.raw({ type: 'image/*' }));
  }
}