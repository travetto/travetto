/// <reference path="./error.d.ts" />
import { AppError } from '@travetto/base';

import { Renderable } from './response/renderable';
import { Response } from './types';
import { MimeType } from './util/mime';

type Status = { status: number };

// @Deprecated
export class RestError extends AppError<Status> implements Renderable {
  constructor(message: string, status: number = 500) {
    super(message, { status });
    console.warn(`${this.constructor.name} is deprecated, consider using ${AppError.name} with a classification instead`);
  }

  render(res: Response) {
    res.status(this.payload!.status);
    res.json({ message: this.message, status: this.payload!.status, type: this.name });
  }
}

// tslint:disable:no-invalid-this
(AppError as any).prototype.render = function (res: Response) {
  let status = this.status || this.statusCode;
  if (!status) {
    switch (this.classification) {
      case 'data': status = 400; break;
      case 'auth': status = 401; break;
      case 'missing': status = 404; break;
      case 'timeout': status = 408; break;
      case 'unavailable': status = 503; break;
      case 'permission': status = 403; break;
      case 'general':
      case 'system':
      default:
        status = 500; break;
    }
  }
  this.status = status;
  (Error as any).prototype.render.call(this, res);
};

(Error as any).prototype.render = function (res: Response) {
  const status = this.status || this.statusCode || 500;
  res.status(status);

  if ('toJSON' in this) {
    res.setHeader('Content-Type', MimeType.JSON);
    res.send(this.toJSON({ status }));
  } else {
    res.json({ message: this.message, status, type: this.type || this.name });
  }
};
// tslint:enable:no-invalid-this
