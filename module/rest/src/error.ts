/// <reference path="./error.d.ts" />
import { Env, HTTP_ERROR_CONVERSION } from '@travetto/base';

import { Response } from './types';
import { MimeType } from './util/mime';

// tslint:disable:no-invalid-this
(Error as any).prototype.render = function (res: Response) {
  const status = this.status || this.statusCode ||
    HTTP_ERROR_CONVERSION.from.get(this.category) ||
    500;

  res.status(status);

  if (status === 500 && Env.dev) {
    console.error(this.stack);
  }

  if ('toJSON' in this) {
    res.setHeader('Content-Type', MimeType.JSON);
    res.send(this.toJSON({ status }));
  } else {
    res.json({ message: this.message, status, type: this.name });
  }
};
// tslint:enable:no-invalid-this
