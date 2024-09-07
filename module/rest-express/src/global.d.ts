import { TravettoEntityⲐ, NodeEntityⲐ } from '@travetto/rest/src/internal/symbol';
import * as rest from '@travetto/rest';
import * as express from 'express';

// Support typings
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line no-shadow
    interface Request {
      [TravettoEntityⲐ]?: rest.Request;
      [NodeEntityⲐ]?: express.Request;
    }
    interface Response {
      [TravettoEntityⲐ]?: rest.Response;
      [NodeEntityⲐ]?: express.Response;
    }
  }
}
