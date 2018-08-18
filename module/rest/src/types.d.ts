import * as exp from 'express-serve-static-core';

declare global {
  namespace Travetto {
    interface Request extends exp.Request { }
    interface Response extends exp.Response { }
  }
}