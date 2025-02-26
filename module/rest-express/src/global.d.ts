import * as express from 'express';

import { Request as TravettoRequest, Response as TravettoResponse } from '@travetto/rest';

import { TravettoEntitySymbol, NodeEntitySymbol } from '@travetto/rest/src/internal/symbol.ts';

// Support typings
declare module 'express' {
  interface Request {
    [TravettoEntitySymbol]?: TravettoRequest;
    [NodeEntitySymbol]?: express.Request;
  }
  interface Response {
    [TravettoEntitySymbol]?: TravettoResponse;
    [NodeEntitySymbol]?: express.Response;
  }
}
