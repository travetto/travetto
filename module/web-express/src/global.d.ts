import { WebSymbols, HttpRequest, HttpResponse } from '@travetto/web';
import * as express from 'express';

// Support typings
declare module 'express' {
  interface Request {
    [WebSymbols.TravettoEntity]?: HttpRequest;
    [WebSymbols.NodeEntity]?: express.Request;
  }
  interface Response {
    [WebSymbols.TravettoEntity]?: HttpResponse;
    [WebSymbols.NodeEntity]?: express.Response;
  }
}
