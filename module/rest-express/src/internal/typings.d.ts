import 'express-serve-static-core';
import { TRV_RAW } from '@travetto/rest/src/types';

declare global {
  namespace Express {
    interface Request {
      [TRV_RAW]: Request;
    }
    interface Response {
      [TRV_RAW]: Response;
    }
  }
}

