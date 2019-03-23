import * as exp from 'express-serve-static-core';
import { Session } from './types';

declare global {
  namespace Travetto {
    interface Request {
      session?: any;
      __rawSession?: Session;
    }
  }
}