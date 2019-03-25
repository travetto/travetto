import * as exp from 'express-serve-static-core';
import { Session, RAW_SESSION, RAW_SESSION_PRIV } from './types';

declare global {
  namespace Travetto {
    interface Request {
      session?: any;
      readonly [RAW_SESSION]: Session;
      [RAW_SESSION_PRIV]: Session;
    }
  }
}