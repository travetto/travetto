import { HttpRequest as WebRequest, HttpResponse as WebResponse, WebSymbols } from '@travetto/web';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [WebSymbols.TravettoEntity]?: WebRequest;
  }
  interface FastifyReply {
    [WebSymbols.TravettoEntity]?: WebResponse;
  }
}
