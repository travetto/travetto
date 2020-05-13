/// <reference path="./error.d.ts" />
import { Env, AppError } from '@travetto/base';
import { ErrorUtil } from '@travetto/base/src/internal/error';

import { Response } from './types';

// TODO: Document
Error.prototype.render = function (res: Response) {
  const status = this.status ??
    this.statusCode ??
    (this instanceof AppError ? ErrorUtil.codeFromCategory(this.category) : 500);

  res.status(status);

  if (status === 500 && !Env.prod) {
    console.error(this.stack);
  }

  const payload = this instanceof AppError ?
    this.toJSON!({ status }) :
    { message: this.message, status, type: this.name };

  res.json(payload);
};
