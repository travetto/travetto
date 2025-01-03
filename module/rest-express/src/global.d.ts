import { TravettoEntitySymbol, NodeEntitySymbol } from '@travetto/rest/src/internal/symbol';
import * as rest from '@travetto/rest';
import * as express from 'express';

// Support typings
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line no-shadow
    interface Request {
      [TravettoEntitySymbol]?: rest.Request;
      [NodeEntitySymbol]?: express.Request;
    }
    interface Response {
      [TravettoEntitySymbol]?: rest.Response;
      [NodeEntitySymbol]?: express.Response;
    }
  }
}
