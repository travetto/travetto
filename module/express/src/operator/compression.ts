import * as express from 'express';
import * as compression from 'compression';

import { Injectable } from '@travetto/di';

import { ExpressOperator } from '../types';

@Injectable()
export class CompressionOperator extends ExpressOperator {

  operate(app: express.Application): void {
    app.use(compression());
  }
}