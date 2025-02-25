import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol.ts';
import * as rest from '@travetto/rest';

// Support typings
declare module 'koa' {
  interface Context {
    [TravettoEntitySymbol]?: [rest.Request, rest.Response];
  }
}
