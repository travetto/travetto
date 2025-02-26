import { Request as TravettoRequest, Response as TravettoResponse } from '@travetto/rest';

import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol.ts';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [TravettoEntitySymbol]?: TravettoRequest;
  }
  interface FastifyReply {
    [TravettoEntitySymbol]?: TravettoResponse;
  }
}
