import { HttpRequest as RestRequest, HttpResponse as RestResponse, RestSymbols } from '@travetto/rest';

// Support typings
declare module 'koa' {
  interface Context {
    [RestSymbols.TravettoEntity]?: [RestRequest, RestResponse];
  }
}
