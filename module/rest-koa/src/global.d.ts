import { TravettoEntityⲐ } from '@travetto/rest/src/internal/symbol';
import * as rest from '@travetto/rest';

// Support typings
declare module 'koa' {
  interface Context {
    [TravettoEntityⲐ]?: [rest.Request, rest.Response];
  }
}
