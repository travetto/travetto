import { Request as TravettoRequest, Response as TravettoResponse } from '@travetto/rest';

import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol.ts';

// Support typings
declare module 'koa' {
  interface Context {
    [TravettoEntitySymbol]?: [TravettoRequest, TravettoResponse];
  }
}
