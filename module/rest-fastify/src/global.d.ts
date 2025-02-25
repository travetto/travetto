import * as rest from '@travetto/rest';

import { TravettoEntitySymbol } from '@travetto/rest/src/internal/symbol';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [TravettoEntitySymbol]?: rest.Request;
  }
  interface FastifyReply {
    [TravettoEntitySymbol]?: rest.Response;
  }
}
