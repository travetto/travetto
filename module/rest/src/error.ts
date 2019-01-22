/// <reference path="./error.d.ts" />
import { AppError } from '@travetto/base';

import { Renderable } from './response/renderable';
import { Response } from './types';
import { MimeType } from './util/mime';

type Status = { status: number };

export class RestError extends AppError<Status> implements Renderable {
  constructor(message: string, status: number = 500) {
    super(message, { status });
  }

  render(res: Response) {
    res.status(this.payload!.status);
    res.json({ message: this.message, status: this.payload!.status, type: this.name });
  }
}

// tslint:disable:no-invalid-this
(Error as any).prototype.render = function (res: Response) {
  const computedStatus = this.status || this.statusCode || 500;
  res.status(computedStatus);

  if ('toJSON' in this) {
    res.setHeader('Content-Type', MimeType.JSON);
    res.send(this.toJSON());
  } else {
    res.json({ message: this.message, status: computedStatus, type: this.type || this.name });
  }
};
// tslint:enable:no-invalid-this
