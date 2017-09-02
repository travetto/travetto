import { Context } from '@encore/context';
import { Request, Response } from 'express';
import { ExpressOperator } from '../src/service/operator';
import { Injectable } from '@encore/di';
import { ExpressApp } from '../index';

@Injectable({
  target: ExpressOperator,
  name: '@encore/context'
})
export class ContextMantainer extends ExpressOperator {

  constructor(private context: Context) {
    super();
  }

  operate(app: ExpressApp) {
    console.log('Filtering');
    app.get().use((req, res, next) => {
      this.context.storage.bindEmitter(req);
      this.context.storage.bindEmitter(res);
      this.context.storage.run(() => {
        this.context.set({ req, res });
        if (next) {
          next();
        }
      });
    });
  }
}
