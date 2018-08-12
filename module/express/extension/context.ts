import * as express from 'express';

import { Context } from '@travetto/context';
import { Injectable, Inject } from '@travetto/di';

import { ExpressOperator } from '../src/types';
import { SessionOperator } from '@travetto/express/src';

@Injectable()
export class ContextOperator extends ExpressOperator {

  @Inject()
  private context: Context;

  before = SessionOperator;

  operate(app: express.Application) {
    app.use((req, res, next) => {
      this.context.run(() => new Promise((resolve, reject) => {
        this.context.set({ req, res });

        // Track request end as result
        req.on('close', resolve);
        req.on('end', resolve);
        req.on('error', reject);
        res.on('close', resolve);
        res.on('finish', resolve);

        if (next) {
          next();
        }
      }));
    });
  }
}
