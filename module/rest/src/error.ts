/// <reference path="./error.d.ts" />
import { Env, HTTP_ERROR_CONVERSION } from '@travetto/base';

import { Response } from './types';

// TODO: Document
(Error as any).prototype.render = function (res: Response) {
  const status = this.status ??
    this.statusCode ??
    HTTP_ERROR_CONVERSION.from.get(this.category) ??
    500;

  res.status(status);

  if (status === 500 && !Env.prod) {
    console.error(this.stack);
  }

  const payload = 'toJSON' in this ?
    this.toJSON({ status }) :
    { message: this.message, status, type: this.name };

  res.json(payload);
};
