import { HttpRequest as WebRequest, HttpResponse as WebResponse, WebSymbols } from '@travetto/web';

// Support typings
declare module 'koa' {
  interface Context {
    [WebSymbols.TravettoEntity]?: [WebRequest, WebResponse];
  }
}
