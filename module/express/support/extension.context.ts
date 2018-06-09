import { Request, Response } from 'express';

import { Context } from '@travetto/context';
import { Injectable } from '@travetto/di';

import { ExpressOperator } from '../src/service/operator';
import { ExpressApp } from '../src/service/app';

@Injectable({
  target: ExpressOperator,
  qualifier: Symbol('@travetto/context')
})
export class ContextMantainer extends ExpressOperator {

  priority = 0;

  constructor(private context: Context) {
    super();
  }

  operate(app: ExpressApp) {
    app.get().use((req, res, next) => {
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
