import * as express from 'express';
import * as bodyParser from 'body-parser';

import { Injectable } from '@travetto/di';

import { ExpressOperator } from '../types';
import { CompressionOperator } from './compression';

@Injectable()
export class BodyOperator extends ExpressOperator {

  after = new Set([CompressionOperator]);

  operate(app: express.Application) {
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(bodyParser.raw({ type: 'image/*' }));
  }
}