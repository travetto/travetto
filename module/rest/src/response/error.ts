import { AppError } from '@travetto/base';
import { ErrorUtil } from '@travetto/base/src/internal/error';

import { Response } from '../types';

declare global {
  interface Error {
    /**
     * Provides the render implementation for sending a response
     * @param res
     */
    render?(res: Response): void;
  }
}

/**
 * Render the error to the response object
 */
Error.prototype.render = function (this: Error & { status?: number, statusCode?: number }, res: Response): void {
  const status = this.status ??
    this.statusCode ??
    (this instanceof AppError ? ErrorUtil.codeFromCategory(this.category) : 500);

  res.status(status);

  if (status === 500) {
    console.error(this.message, { error: this });
  }

  res.setHeader('Content-Type', 'application/json');
  res.send(this.toJSON({ status }));
};
