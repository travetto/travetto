import { TravettoEntitySymbol, NodeEntitySymbol } from '@travetto/rest/src/internal/symbol';
import * as rest from '@travetto/rest';
import * as express from 'express';

// Support typings
declare module 'express' {
  interface Request {
    [TravettoEntitySymbol]?: rest.Request;
    [NodeEntitySymbol]?: express.Request;
  }
  interface Response {
    [TravettoEntitySymbol]?: rest.Response;
    [NodeEntitySymbol]?: express.Response;
  }
}
