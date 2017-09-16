import { Context } from '@encore2/context';

import { Request, Response } from 'express';
import { ExpressOperator } from '../src/service/operator';
import { Injectable } from '@encore2/di';
import { ExpressApp } from '../index';

@Injectable({
  target: ExpressOperator,
  name: '@encore2/context'
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
