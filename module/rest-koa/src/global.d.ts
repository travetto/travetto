import { Request as RestRequest, Response as RestResponse, RestSymbols } from '@travetto/rest';

// Support typings
declare module 'koa' {
  interface Context {
    [RestSymbols.TravettoEntity]?: [RestRequest, RestResponse];
  }
}
