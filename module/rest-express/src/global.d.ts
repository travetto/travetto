import { RestSymbols, Request as RestRequest, Response as RestResponse } from '@travetto/rest';
import * as express from 'express';

// Support typings
declare module 'express' {
  interface Request {
    [RestSymbols.TravettoEntity]?: RestRequest;
    [RestSymbols.NodeEntity]?: express.Request;
  }
  interface Response {
    [RestSymbols.TravettoEntity]?: RestResponse;
    [RestSymbols.NodeEntity]?: express.Response;
  }
}
