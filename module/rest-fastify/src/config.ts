import { Config } from '@travetto/config';

@Config('rest.fastify')
export class FastifyConfig {
  session = {
    cookie: {
      secure: false
    },
    secret: 'secret1secret2secret3secret4secret5'
  };
}