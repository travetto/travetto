import { Request as RestRequest, Response as RestResponse, RestSymbols } from '@travetto/rest';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [RestSymbols.TravettoEntity]?: RestRequest;
  }
  interface FastifyReply {
    [RestSymbols.TravettoEntity]?: RestResponse;
  }
}
