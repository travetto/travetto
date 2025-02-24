import * as rest from '@travetto/rest';

import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol.ts';

// Support typings
declare module 'koa' {
  interface Context {
    [TravettoEntitySymbol]?: [rest.Request, rest.Response];
  }
}
