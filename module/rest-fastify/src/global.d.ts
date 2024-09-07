import { TravettoEntityⲐ } from '@travetto/rest/src/internal/symbol';
import * as rest from '@travetto/rest';

// Support typings
declare module 'fastify' {
  interface FastifyRequest {
    [TravettoEntityⲐ]?: rest.Request;
  }
  interface FastifyReply {
    [TravettoEntityⲐ]?: rest.Response;
  }
}
