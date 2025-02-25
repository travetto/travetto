import * as rest from '@travetto/rest';

import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol';

// Support typings
declare module 'koa' {
  interface Context {
    [TravettoEntitySymbol]?: [rest.Request, rest.Response];
  }
}
