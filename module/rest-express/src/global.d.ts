import { RestSymbols, HttpRequest, HttpResponse } from '@travetto/rest';
import * as express from 'express';

// Support typings
declare module 'express' {
  interface Request {
    [RestSymbols.TravettoEntity]?: HttpRequest;
    [RestSymbols.NodeEntity]?: express.Request;
  }
  interface Response {
    [RestSymbols.TravettoEntity]?: HttpResponse;
    [RestSymbols.NodeEntity]?: express.Response;
  }
}
