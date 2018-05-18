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

  constructor(private context: Context) {
    super();
  }

  priority = 0;

  operate(app: ExpressApp) {
    app.get().use((req, res, next) => {
      this.context.namespace.bindEmitter(req);
      this.context.namespace.bindEmitter(res);
      this.context.namespace.run(() => {
        this.context.set({ req, res });
        if (next) {
          next();
        }
      });
    });
  }
}
